/** Phones: no file picker here (paste the export instead). */
export const canPickTextFile = false;
export async function pickTextFile(): Promise<{ name: string; text: string } | null> {
  return null;
}
