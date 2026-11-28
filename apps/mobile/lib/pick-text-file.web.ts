/** The most an import file may be (a big Todoist or TickTick backup is well under this). */
const MAX_BYTES = 5 * 1024 * 1024;

export const canPickTextFile = true;

/**
 * Computer: choose a .csv / .txt / .md export and read it as text, on this device only. Null when
 * cancelled; throws when the file is too big to be an export.
 */
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".csv,.txt,.md,.markdown,text/csv,text/plain,text/markdown";
  input.style.display = "none";
  document.body.appendChild(input);
  try {
    const file = await new Promise<File | null>((resolve) => {
      input.addEventListener("cancel", () => resolve(null), { once: true });
      input.addEventListener("change", () => resolve(input.files?.[0] ?? null), { once: true });
      input.click();
    });
    if (!file) return null;
    if (file.size > MAX_BYTES) throw new Error("That file is too big to be an export (over 5 MB).");
    return { name: file.name, text: await file.text() };
  } finally {
    input.remove();
  }
}
