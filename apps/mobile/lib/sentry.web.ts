/** Web no-op for crash reporting. The @sentry/react-native SDK doesn't bundle cleanly for web; the
 *  native init already no-ops without a DSN, so skipping it entirely on web is equivalent. */
export function initSentry(): void {}
