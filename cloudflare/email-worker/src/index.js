// Nox — Cloudflare Email Worker for "Email to Nox".
//
// Email Routing sends every message for *@<your inbound domain> here (a catch-all rule). The worker
// passes the raw message to Supabase's inbound-email function with a shared secret, and rejects the
// email (so the sender gets a bounce, not silence) when Nox doesn't know the address or refuses it.
// It reads nothing itself and stores nothing.
//
// Settings (wrangler secrets / vars):  NOX_INBOUND_URL  https://<ref>.supabase.co/functions/v1/inbound-email
//                                      NOX_INBOUND_SECRET  the same value as the function's INBOUND_EMAIL_SECRET

const MAX_BYTES = 1_000_000;

export default {
  async email(message, env) {
    if (message.rawSize > MAX_BYTES) {
      message.setReject("Message too large for Nox (1 MB max).");
      return;
    }
    const raw = await new Response(message.raw).arrayBuffer();
    let res;
    try {
      res = await fetch(env.NOX_INBOUND_URL, {
        method: "POST",
        headers: {
          "Content-Type": "message/rfc822",
          "x-inbound-secret": env.NOX_INBOUND_SECRET,
          "x-nox-to": message.to,
          "x-nox-from": message.from,
        },
        body: raw,
      });
    } catch {
      // Nox is unreachable: a temporary failure, so the sending server tries again later.
      throw new Error("Nox is unavailable; try again later.");
    }
    if (res.status === 404) message.setReject("Unknown Nox address.");
    else if (res.status === 403) message.setReject("This Nox address only accepts mail from its owner's email.");
    else if (res.status === 413) message.setReject("Message too large for Nox.");
    else if (res.status === 429) message.setReject("Too many emails to this Nox address today.");
    else if (!res.ok) throw new Error(`Nox returned ${res.status}`);
  },
};
