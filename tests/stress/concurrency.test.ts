import { describe, it, expect } from "vitest";
import { timedFetch, stats, BASE_URL } from "./helpers";

async function burst(
  count: number,
  fn: () => Promise<{ status: number; durationMs: number }>
) {
  const results = await Promise.all(Array.from({ length: count }, fn));
  return {
    results,
    statuses: results.map((r) => r.status),
    durations: results.map((r) => r.durationMs),
  };
}

describe("Concurrent load handling", () => {
  it("handles 20 simultaneous GET /api/dashboard requests", async () => {
    const { statuses, durations } = await burst(20, () =>
      timedFetch("/api/dashboard?month=2&year=2026")
    );
    const s = stats(durations);
    console.log("20x GET /api/dashboard:", s);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(s.max).toBeLessThan(10000);
  });

  it("handles 20 simultaneous GET /api/transactions requests", async () => {
    const { statuses, durations } = await burst(20, () =>
      timedFetch("/api/transactions?page=1&limit=50")
    );
    const s = stats(durations);
    console.log("20x GET /api/transactions:", s);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(s.max).toBeLessThan(10000);
  });

  it("handles 20 simultaneous GET /api/trends requests", async () => {
    const { statuses, durations } = await burst(20, () =>
      timedFetch("/api/trends")
    );
    const s = stats(durations);
    console.log("20x GET /api/trends:", s);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(s.max).toBeLessThan(10000);
  });

  it("handles 20 simultaneous GET /api/dashboard/prediction requests", async () => {
    const { statuses, durations } = await burst(20, () =>
      timedFetch("/api/dashboard/prediction")
    );
    const s = stats(durations);
    console.log("20x GET /api/dashboard/prediction:", s);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(s.max).toBeLessThan(10000);
  });

  it("handles 50 simultaneous mixed-endpoint requests", async () => {
    const endpoints = [
      "/api/accounts",
      "/api/budgets",
      "/api/categories",
      "/api/dashboard?month=2&year=2026",
      "/api/dashboard/prediction",
      "/api/recurring",
      "/api/transactions?page=1&limit=20",
      "/api/trends",
      "/api/transactions/suggestions?q=a&type=expense&limit=3",
      "/api/budgets?month=2026-01",
    ];

    const requests = Array.from({ length: 50 }, (_, i) => {
      const ep = endpoints[i % endpoints.length];
      return timedFetch(ep);
    });

    const results = await Promise.all(requests);
    const durations = results.map((r) => r.durationMs);
    const s = stats(durations);
    console.log("50x mixed endpoints:", s);

    const all401 = results.every((r) => r.status === 401);
    expect(all401).toBe(true);
    expect(s.max).toBeLessThan(15000);
  });

  it("handles 30 rapid sequential POST requests without crashing", async () => {
    const durations: number[] = [];

    for (let i = 0; i < 30; i++) {
      const res = await timedFetch("/api/transactions/create", {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 100,
          date: "2026-03-01",
          description: `stress-test-${i}`,
        }),
      });
      durations.push(res.durationMs);
      expect(res.status).toBe(401);
    }

    const s = stats(durations);
    console.log("30x sequential POST /api/transactions/create:", s);

    expect(s.max).toBeLessThan(5000);
  });

  it("handles 100 concurrent lightweight GET requests", async () => {
    const { statuses, durations } = await burst(100, () =>
      timedFetch("/api/categories")
    );
    const s = stats(durations);
    console.log("100x GET /api/categories:", s);

    expect(statuses.every((s) => s === 401)).toBe(true);
    expect(s.p99).toBeLessThan(15000);
  });
});
