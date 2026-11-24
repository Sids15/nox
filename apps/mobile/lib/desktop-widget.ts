/**
 * Desktop widget window bridge. Native builds have no desktop widget (Android has its own home-screen
 * widget), so everything here is inert; `desktop-widget.web.ts` is the Tauri implementation.
 */
export const isWidgetWindow = (): boolean => false;
export const canOpenDesktopWidget = (): boolean => false;
export async function toggleDesktopWidget(): Promise<void> {}
export async function setWidgetAlwaysOnTop(_on: boolean): Promise<void> {}
export async function hideWidgetWindow(): Promise<void> {}
export async function openInMainWindow(_path: string): Promise<void> {}
export function useOpenFromWidget(): void {}
