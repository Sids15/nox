import * as ImagePicker from "expo-image-picker";

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
}

/** Prompt for library permission and pick a single photo. Returns null if denied/cancelled. */
export async function pickImage(): Promise<PickedImage | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return null;

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
    allowsMultipleSelection: false,
  });
  const asset = res.canceled ? null : res.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, width: asset.width ?? 1, height: asset.height ?? 1 };
}
