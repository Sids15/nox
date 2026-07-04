import { newId } from "@nox/db";
import { useSessionStore } from "@nox/features";
import type { ContentBlock } from "@nox/types";
import { pickImage } from "../../lib/media";
import { uploadToBucket } from "../../lib/storage";

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
    const localUri = picked.uri;
    editor.insertMedia({
      type: "image",
      localUri,
      storagePath: null,
      width: picked.width,
      height: picked.height,
    });
    const path = await uploadToBucket("images", `${userId}/${parentId}/${newId()}.jpg`, localUri, "image/jpeg");
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
