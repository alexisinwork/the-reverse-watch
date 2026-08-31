export const EMAIL_PROVIDER_TIMEOUT_MS = 10_000;

export function emailProviderTimeoutSignal() {
  return AbortSignal.timeout(EMAIL_PROVIDER_TIMEOUT_MS);
}
