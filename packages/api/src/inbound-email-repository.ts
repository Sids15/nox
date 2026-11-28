import { supabase } from "@nox/db";

const isMissing = (error: { code?: string } | null) => ["42P01", "PGRST205", "PGRST202"].includes(error?.code ?? "");

export interface InboundAddress {
  token: string;
  any_sender: boolean;
}

async function userId(): Promise<string> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

const parse = (row: unknown): InboundAddress | null => {
  const r = row as { token?: unknown; any_sender?: unknown } | null;
  return r && typeof r.token === "string" && /^[a-z0-9]{20}$/.test(r.token) ? { token: r.token, any_sender: r.any_sender === true } : null;
};

/** "Email to Nox" (migration 0020): this account's private address. The database picks the token. */
export const InboundEmailRepository = {
  /** Undefined on a database without 0020; null when no address has been made yet. */
  async get(): Promise<InboundAddress | null | undefined> {
    const { data, error } = await supabase.from("inbound_addresses").select("token, any_sender").eq("user_id", await userId()).maybeSingle();
    if (isMissing(error)) return undefined;
    if (error) throw error;
    return parse(data);
  },

  async create(): Promise<InboundAddress> {
    const { data, error } = await supabase.from("inbound_addresses").insert({ user_id: await userId() }).select("token, any_sender").single();
    if (error) throw error;
    const out = parse(data);
    if (!out) throw new Error("Unexpected address");
    return out;
  },

  /** A new address; the old one stops working. */
  async renew(): Promise<InboundAddress> {
    const { error } = await supabase.from("inbound_addresses").delete().eq("user_id", await userId());
    if (error) throw error;
    return InboundEmailRepository.create();
  },

  async setAnySender(any: boolean): Promise<void> {
    const { error } = await supabase.from("inbound_addresses").update({ any_sender: any }).eq("user_id", await userId());
    if (error) throw error;
  },
};
