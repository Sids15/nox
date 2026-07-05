import { supabase } from "@nox/db";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

export { useSignedUrl } from "./signed-url";

/**
 * Upload a local file to a private bucket. Reads the file as base64 (RN has no File/Blob for
 * `file://`) and decodes to bytes for supabase-js. Returns the object path on success, else null
 * (best-effort — never throws; the caller keeps the local URI). Path convention: {user_id}/{parent}/…
 */
export async function uploadToBucket(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: "base64" });
    const { error } = await supabase.storage
      .from(bucket)
      .upload(path, decode(base64), { contentType, upsert: true });
    if (error) {
      console.warn("[storage] upload failed:", error.message);
      return null;
    }
    return path;
  } catch (e) {
    console.warn("[storage] upload error:", e);
    return null;
  }
}
