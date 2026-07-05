/** Web no-op — no local notification scheduling in the browser. Keeps expo-notifications out of the
 *  web bundle while matching the native hook's signature (mounted once in the root layout). */
export function useNotifications(): void {}
