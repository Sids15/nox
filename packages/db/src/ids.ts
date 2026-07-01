import * as Crypto from "expo-crypto";

/** Client-generated UUIDs let us build rows optimistically before the server round-trip. */
export function newId(): string {
  return Crypto.randomUUID();
}
