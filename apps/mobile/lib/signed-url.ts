import { supabase } from "@nox/db";
import { useQuery } from "@tanstack/react-query";

/** Cached signed URL for reading a private object (e.g. an image synced from another device).
 *  Platform-neutral (supabase + TanStack only) so both the native and web storage shims reuse it. */
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
