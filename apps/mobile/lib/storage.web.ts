import { supabase } from "@nox/db";

export { useSignedUrl } from "./signed-url";

/**
 * Web upload: the browser gives us a fetchable object URL (blob:/data:/http) from the file input, so
 * we read it as a Blob and hand it straight to supabase-js — no base64/expo-file-system needed.
 * Same contract as the native `uploadToBucket`: returns the object path on success, else null.
 */
export async function uploadToBucket(
  bucket: string,
  path: string,
  uri: string,
  contentType: string,
): Promise<string | null> {
  try {
    const blob = await (await fetch(uri)).blob();
    const { error } = await supabase.storage.from(bucket).upload(path, blob, { contentType, upsert: true });
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
