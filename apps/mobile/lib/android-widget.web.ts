/** No Android widget on the web or desktop builds (the desktop has its own widget window). */
export function useAndroidWidgetSync(): void {}
export function clearAndroidWidget(): void {}
export function useAndroidShare(_signedIn: boolean): void {}
