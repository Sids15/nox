import { requireOptionalNativeModule } from "expo";

interface NoxWidgetNative {
  setSnapshot(json: string): boolean;
  clear(): boolean;
  /** Text or a link shared to Nox from another app, once; null when there's none. */
  takeSharedText?(): string | null;
  addListener?(event: "onShare", listener: (e: { text: string }) => void): { remove(): void };
}

/** The Android widget and share bridge, or null where there's none (iOS, web, Expo Go). */
export const NoxWidget = requireOptionalNativeModule<NoxWidgetNative>("NoxWidget");
