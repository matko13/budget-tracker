export const BASE_URL =
  process.env.STRESS_TEST_URL || "https://budget-tracker2-two.vercel.app";

export interface TimedResponse {
  status: number;
  body: unknown;
  durationMs: number;
  ok: boolean;
}

export async function timedFetch(
  path: string,
  init?: RequestInit
): Promise<TimedResponse> {
  const start = performance.now();
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  const durationMs = performance.now() - start;
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = await res.text().catch(() => null);
  }
  return { status: res.status, body, durationMs, ok: res.ok };
}

export async function concurrentRequests(
  requests: Array<() => Promise<TimedResponse>>,
): Promise<TimedResponse[]> {
  return Promise.all(requests.map((fn) => fn()));
}

export function stats(durations: number[]) {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  return {
    count: sorted.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / sorted.length,
    median: sorted[Math.floor(sorted.length / 2)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}
