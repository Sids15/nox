import type { PickedImage } from "./media";

/** Natural dimensions of a picked file, best-effort — the caller only uses these for the block's aspect ratio. */
async function readDimensions(file: File): Promise<{ width: number; height: number }> {
  try {
    const bitmap = await createImageBitmap(file);
    const size = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return size;
  } catch {
    return { width: 1, height: 1 };
  }
}

/**
 * Web counterpart of the native `pickImage`. There's no permission prompt in the browser — opening
 * the file dialog *is* the grant — so we go straight to an `<input type="file">`.
 *
 * The returned `uri` is a `blob:` object URL, which `storage.web.ts` uploads by `fetch`-ing it back
 * into a Blob. We deliberately do NOT revoke it: the editor renders the block from this URL until the
 * upload fills in `storagePath`. It dies with the document, which is the same lifetime the native
 * `file://` URI effectively has.
 *
 * Unlike native we don't recompress, so a large PNG arrives at full size; the caller's 10MB check is
 * what enforces the bucket limit. `file.type` is passed through unmassaged — an empty or exotic type
 * fails the caller's mime allow-list rather than being mislabelled as JPEG.
 */
export async function pickImage(): Promise<PickedImage | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.style.display = "none";
  document.body.appendChild(input);

  try {
    const file = await new Promise<File | null>((resolve) => {
      // 'cancel' fires in Chromium (and so in WebView2) when the dialog is dismissed; without it a
      // cancelled pick would leave this promise — and the caller's await — hanging forever.
      input.addEventListener("cancel", () => resolve(null), { once: true });
      input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
      input.click();
    });
    if (!file) return null;

    const { width, height } = await readDimensions(file);
    return {
      uri: URL.createObjectURL(file),
      width,
      height,
      mimeType: file.type,
      fileSize: file.size,
    };
  } finally {
    input.remove();
  }
}
