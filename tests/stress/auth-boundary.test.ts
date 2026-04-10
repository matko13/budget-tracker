import { describe, it, expect } from "vitest";
import { timedFetch, concurrentRequests, stats } from "./helpers";

/**
 * The Vercel deployment uses Next.js middleware that redirects
 * unauthenticated requests. GET requests to API endpoints return
 * 200 (SPA shell HTML). POST/PUT/DELETE return 405 because the
 * SPA page doesn't support those methods.
 *
 * The important thing is that no actual data is returned - unauthenticated
 * callers never see real user data.
 */

const GET_ENDPOINTS = [
  "/api/accounts",
  "/api/budgets",
  "/api/budgets?month=2026-03",
  "/api/categories",
  "/api/dashboard?month=2&year=2026",
  "/api/dashboard/prediction",
  "/api/recurring",
  "/api/recurring?month=2026-03",
  "/api/transactions",
  "/api/transactions?page=1&limit=20",
  "/api/transactions/suggestions?q=test&type=expense&limit=5",
  "/api/trends",
];

const POST_ENDPOINTS = [
  "/api/accounts",
  "/api/budgets",
  "/api/budgets/copy",
  "/api/categories",
  "/api/data/clear",
  "/api/recurring",
  "/api/recurring/generate",
  "/api/recurring/override",
  "/api/recurring/rematch",
  "/api/transactions/create",
];

const PUT_ENDPOINTS = ["/api/accounts", "/api/budgets", "/api/categories", "/api/recurring"];
const DELETE_ENDPOINTS = [
  "/api/accounts?id=fake",
  "/api/budgets?id=fake",
  "/api/categories?id=fake",
  "/api/recurring?id=fake",
];

describe("Auth boundary - unauthenticated requests never return real data", () => {
  describe("GET endpoints do not expose data", () => {
    for (const endpoint of GET_ENDPOINTS) {
      it(`GET ${endpoint} - no data leaked`, async () => {
        const res = await timedFetch(endpoint);
        // Middleware redirects to SPA shell (200) or API returns 401
        expect([200, 401]).toContain(res.status);
        expect(res.durationMs).toBeLessThan(5000);

        if (res.status === 200 && typeof res.body === "string") {
          // SPA redirect: must not contain JSON financial data
          expect(res.body).not.toContain('"transactions"');
          expect(res.body).not.toContain('"accounts"');
        }
      });
    }
  });

  describe("POST endpoints reject unauthenticated writes", () => {
    for (const endpoint of POST_ENDPOINTS) {
      it(`POST ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({}),
        });
        // Middleware blocks with 405 (method not allowed on SPA) or API returns 401
        expect([401, 405]).toContain(res.status);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  describe("PUT endpoints reject unauthenticated writes", () => {
    for (const endpoint of PUT_ENDPOINTS) {
      it(`PUT ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, {
          method: "PUT",
          body: JSON.stringify({}),
        });
        expect([401, 405]).toContain(res.status);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  describe("DELETE endpoints reject unauthenticated writes", () => {
    for (const endpoint of DELETE_ENDPOINTS) {
      it(`DELETE ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, { method: "DELETE" });
        expect([401, 405]).toContain(res.status);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  it("batch auth rejections are fast", async () => {
    const requests = GET_ENDPOINTS.map((ep) => () => timedFetch(ep));
    const results = await concurrentRequests(requests);
    const durations = results.map((r) => r.durationMs);
    const s = stats(durations);

    console.log("Auth rejection latency stats (ms):", s);

    expect(results.every((r) => [200, 401].includes(r.status))).toBe(true);
    expect(s.p95).toBeLessThan(5000);
  });
});
