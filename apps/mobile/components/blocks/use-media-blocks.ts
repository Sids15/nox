import { newId } from "@nox/db";
import { useSessionStore } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { Alert } from "react-native";
import { pickImage } from "../../lib/media";
import { uploadToBucket } from "../../lib/storage";

// Keep in sync with the `images` bucket policy (migration 0006).
const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_MIME_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

type EditorMediaApi = {
  insertMedia: (b: ContentBlock) => void;
  patchMedia: (match: (b: ContentBlock) => boolean, patch: Partial<ContentBlock>) => void;
};

/**
 * Media inserts for the block editor. Shows the local file instantly, then uploads to Storage and
 * fills in `storagePath` (path `{user_id}/{parentId}/{uuid}`) so it syncs across devices. `parentId`
 * is the owning idea/note id. Audio wiring arrives in Stage C.
 */
export function useMediaBlocks(parentId: string, editor: EditorMediaApi) {
  const userId = useSessionStore((s) => s.session?.user.id ?? null);

  const addImage = async () => {
    const picked = await pickImage();
    if (!picked || !userId) return;

    // Validate at the client boundary (rules.md): supported type + within the bucket size limit.
    const ext = IMAGE_MIME_EXT[picked.mimeType];
    if (!ext) {
      Alert.alert("Unsupported image", "Please choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (picked.fileSize && picked.fileSize > IMAGE_MAX_BYTES) {
      Alert.alert("Image too large", "Please choose an image under 10 MB.");
      return;
    }

    const localUri = picked.uri;
    editor.insertMedia({
      type: "image",
      localUri,
      storagePath: null,
      width: picked.width,
      height: picked.height,
    });
    const path = await uploadToBucket("images", `${userId}/${parentId}/${newId()}.${ext}`, localUri, picked.mimeType);
    if (path) editor.patchMedia((b) => b.type === "image" && b.localUri === localUri, { storagePath: path });
  };

  const addAudio = async (localUri: string, durationMs: number) => {
    if (!userId) return;
    editor.insertMedia({ type: "audio", localUri, storagePath: null, durationMs });
    const path = await uploadToBucket("audio", `${userId}/${parentId}/${newId()}.m4a`, localUri, "audio/m4a");
    if (path) editor.patchMedia((b) => b.type === "audio" && b.localUri === localUri, { storagePath: path });
  };

  return { addImage, addAudio };
}
