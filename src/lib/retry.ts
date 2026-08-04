/** Retry a call that failed because the network dropped it (no HTTP response).
 *
 * Only transport-level failures are retried — an actual server error such as
 * "房间满了" must surface immediately instead of being attempted again.
 */
export function isTransientNetworkError(err: unknown) {
  const message = (err instanceof Error ? err.message : String(err ?? "")).toLowerCase();
  return (
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network error") ||
    message.includes("load failed") ||
    message.includes("connection") ||
    message.includes("err_") ||
    message.includes("timeout") ||
    message.includes("aborted")
  );
}

export async function retryTransient<T>(
  fn: () => Promise<T>,
  { attempts = 4, baseDelayMs = 400 }: { attempts?: number; baseDelayMs?: number } = {},
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientNetworkError(err) || i === attempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** i));
    }
  }
  throw lastError;
}
