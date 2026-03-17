import { describe, it, expect } from "vitest";
import { timedFetch, concurrentRequests, stats } from "./helpers";

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

const POST_ENDPOINTS_EMPTY_BODY = [
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

describe("Auth boundary - all endpoints reject unauthenticated requests", () => {
  describe("GET endpoints return 401", () => {
    for (const endpoint of GET_ENDPOINTS) {
      it(`GET ${endpoint}`, async () => {
        const res = await timedFetch(endpoint);
        expect(res.status).toBe(401);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  describe("POST endpoints return 401", () => {
    for (const endpoint of POST_ENDPOINTS_EMPTY_BODY) {
      it(`POST ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, {
          method: "POST",
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(401);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  describe("PUT endpoints return 401", () => {
    for (const endpoint of PUT_ENDPOINTS) {
      it(`PUT ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, {
          method: "PUT",
          body: JSON.stringify({}),
        });
        expect(res.status).toBe(401);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  describe("DELETE endpoints return 401", () => {
    for (const endpoint of DELETE_ENDPOINTS) {
      it(`DELETE ${endpoint}`, async () => {
        const res = await timedFetch(endpoint, { method: "DELETE" });
        expect(res.status).toBe(401);
        expect(res.durationMs).toBeLessThan(5000);
      });
    }
  });

  it("auth rejections are fast (batch timing)", async () => {
    const requests = GET_ENDPOINTS.map(
      (ep) => () => timedFetch(ep)
    );
    const results = await concurrentRequests(requests);
    const durations = results.map((r) => r.durationMs);
    const s = stats(durations);

    console.log("Auth rejection latency stats (ms):", s);

    expect(results.every((r) => r.status === 401)).toBe(true);
    expect(s.p95).toBeLessThan(5000);
  });
});
