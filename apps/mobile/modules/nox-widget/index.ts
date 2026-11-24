import { requireOptionalNativeModule } from "expo";

interface NoxWidgetNative {
  setSnapshot(json: string): boolean;
  clear(): boolean;
}

/** The Android widget bridge, or null where there's no widget (iOS, web, Expo Go). */
export const NoxWidget = requireOptionalNativeModule<NoxWidgetNative>("NoxWidget");
