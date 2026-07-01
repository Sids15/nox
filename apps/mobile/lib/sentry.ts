import { env } from "@nox/db";
import * as Sentry from "@sentry/react-native";

/**
 * Initialise crash reporting. No-ops when no DSN is configured (e.g. local dev).
 * PII is scrubbed: we never send default PII and reduce the user object to an id.
 */
export function initSentry(): void {
  if (!env.sentryDsn) return;

  Sentry.init({
    dsn: env.sentryDsn,
    sendDefaultPii: false,
    tracesSampleRate: 0.2,
    beforeSend(event) {
      if (event.user) {
        event.user = { id: event.user.id };
      }
      return event;
    },
  });
}
