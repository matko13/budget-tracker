import { describe, it, expect } from "vitest";
import { timedFetch, stats, BASE_URL } from "./helpers";

describe("Sustained load", () => {
  it("handles 200 requests over 10 seconds to mixed endpoints", async () => {
    const endpoints = [
      "/api/accounts",
      "/api/categories",
      "/api/dashboard?month=2&year=2026",
      "/api/dashboard/prediction",
      "/api/budgets?month=2026-03",
      "/api/transactions?page=1&limit=10",
      "/api/recurring?month=2026-03",
      "/api/trends",
    ];

    const totalRequests = 200;
    const durationSec = 10;
    const intervalMs = (durationSec * 1000) / totalRequests;

    const results: { status: number; durationMs: number }[] = [];
    const errors: string[] = [];

    const startTime = performance.now();
    const promises: Promise<void>[] = [];

    for (let i = 0; i < totalRequests; i++) {
      const ep = endpoints[i % endpoints.length];
      const delay = i * intervalMs;

      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(async () => {
            try {
              const res = await timedFetch(ep);
              results.push({ status: res.status, durationMs: res.durationMs });
            } catch (err) {
              errors.push(`Request ${i} (${ep}): ${err}`);
            }
            resolve();
          }, delay);
        })
      );
    }

    await Promise.all(promises);
    const totalTime = performance.now() - startTime;

    const durations = results.map((r) => r.durationMs);
    const s = stats(durations);
    const statusCounts: Record<number, number> = {};
    for (const r of results) {
      statusCounts[r.status] = (statusCounts[r.status] || 0) + 1;
    }

    console.log(`Sustained load: ${totalRequests} requests in ${(totalTime / 1000).toFixed(1)}s`);
    console.log("Latency stats (ms):", s);
    console.log("Status distribution:", statusCounts);
    console.log("Errors:", errors.length);

    const successRate = results.length / totalRequests;
    expect(successRate).toBeGreaterThan(0.95);
    expect(errors.length).toBeLessThan(totalRequests * 0.05);
    expect(s.p95).toBeLessThan(10000);
  });

  it("handles rapid-fire burst of 50 POST requests", async () => {
    const results = await Promise.all(
      Array.from({ length: 50 }, (_, i) =>
        timedFetch("/api/transactions/create", {
          method: "POST",
          body: JSON.stringify({
            type: "expense",
            amount: Math.random() * 1000,
            date: `2026-03-${String((i % 28) + 1).padStart(2, "0")}`,
            description: `burst-${i}-${Date.now()}`,
          }),
        })
      )
    );

    const durations = results.map((r) => r.durationMs);
    const s = stats(durations);
    console.log("50x burst POST:", s);

    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(s.p95).toBeLessThan(10000);
  });

  it("handles alternating GET/POST pattern (100 requests)", async () => {
    const results: { status: number; durationMs: number; method: string }[] = [];

    const requests = Array.from({ length: 100 }, (_, i) => {
      if (i % 2 === 0) {
        return timedFetch("/api/transactions?page=1&limit=5").then((r) => ({
          ...r,
          method: "GET",
        }));
      }
      return timedFetch("/api/transactions/create", {
        method: "POST",
        body: JSON.stringify({
          type: "expense",
          amount: 50,
          date: "2026-03-15",
          description: `alt-${i}`,
        }),
      }).then((r) => ({ ...r, method: "POST" }));
    });

    const all = await Promise.all(requests);
    const getResults = all.filter((r) => r.method === "GET");
    const postResults = all.filter((r) => r.method === "POST");

    console.log("GET latency:", stats(getResults.map((r) => r.durationMs)));
    console.log("POST latency:", stats(postResults.map((r) => r.durationMs)));

    expect(all.every((r) => r.status === 401)).toBe(true);
  });
});

describe("Import endpoint resilience", () => {
  it("rejects CSV import without file", async () => {
    const form = new FormData();
    form.append("action", "preview");
    const res = await fetch(`${BASE_URL}/api/import/csv`, {
      method: "POST",
      body: form,
    });
    expect([400, 401]).toContain(res.status);
  });

  it("rejects CSV import with empty file", async () => {
    const form = new FormData();
    form.append("action", "preview");
    form.append("file", new Blob([""]), "empty.csv");
    const res = await fetch(`${BASE_URL}/api/import/csv`, {
      method: "POST",
      body: form,
    });
    expect([400, 401]).toContain(res.status);
  });

  it("rejects CSV import with garbage data", async () => {
    const garbage = Buffer.from(Array.from({ length: 50000 }, () => Math.random() * 256)).toString(
      "base64"
    );
    const form = new FormData();
    form.append("action", "preview");
    form.append("file", new Blob([garbage]), "garbage.csv");
    const res = await fetch(`${BASE_URL}/api/import/csv`, {
      method: "POST",
      body: form,
    });
    expect([400, 401, 500]).toContain(res.status);
  });

  it("handles very large CSV file (500KB)", async () => {
    const header = "date,amount,description,type\n";
    const rows = Array.from(
      { length: 10000 },
      (_, i) => `2026-03-01,${i}.99,transaction-${i},expense`
    ).join("\n");
    const form = new FormData();
    form.append("action", "preview");
    form.append("file", new Blob([header + rows]), "large.csv");
    const res = await fetch(`${BASE_URL}/api/import/csv`, {
      method: "POST",
      body: form,
    });
    expect([400, 401, 413, 500]).toContain(res.status);
  });
});

describe("Non-existent routes", () => {
  it("returns 404 for non-existent API route", async () => {
    const res = await timedFetch("/api/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns 404 for deeply nested non-existent route", async () => {
    const res = await timedFetch("/api/a/b/c/d/e/f/g");
    expect(res.status).toBe(404);
  });

  it("handles non-existent transaction ID", async () => {
    const res = await timedFetch(
      "/api/transactions/00000000-0000-0000-0000-000000000000"
    );
    expect([401, 404]).toContain(res.status);
  });
});
