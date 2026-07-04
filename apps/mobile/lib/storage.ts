import { supabase } from "@nox/db";
import { useQuery } from "@tanstack/react-query";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

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

/** Cached signed URL for reading a private object (e.g. an image synced from another device). */
export function useSignedUrl(bucket: string, path: string | null) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 55 * 60 * 1000,
    queryFn: async () => {
      if (!path) return null;
      const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
      return error ? null : data.signedUrl;
    },
  });
}
