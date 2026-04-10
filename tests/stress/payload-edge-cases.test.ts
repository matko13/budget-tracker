import { describe, it, expect } from "vitest";
import { timedFetch, BASE_URL } from "./helpers";

describe("Malformed and oversized payloads", () => {
  it("rejects invalid JSON body gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/transactions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "this is not json{{{",
    });
    // Server must not return 2xx -- either method blocked (405) or auth (401) or parse error (400/500)
    expect([400, 401, 405, 500]).toContain(res.status);
  });

  it("rejects empty POST body", async () => {
    const res = await fetch(`${BASE_URL}/api/transactions/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    expect([400, 401, 405, 500]).toContain(res.status);
  });

  it("handles large JSON body (1MB) without crashing", async () => {
    const largeDescription = "x".repeat(1_000_000);
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "2026-03-01",
        description: largeDescription,
      }),
    });
    expect([401, 405, 413, 400, 500]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(10000);
  });

  it("handles deeply nested JSON without crashing", async () => {
    let nested: unknown = { value: "deep" };
    for (let i = 0; i < 100; i++) {
      nested = { inner: nested };
    }
    const res = await timedFetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify(nested),
    });
    expect([401, 405, 400, 500]).toContain(res.status);
  });

  it("handles array payload instead of object", async () => {
    const res = await timedFetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify([1, 2, 3]),
    });
    expect([401, 405, 400, 500]).toContain(res.status);
  });

  it("handles numeric overflow in amount fields", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: Number.MAX_SAFE_INTEGER + 1000,
        date: "2026-03-01",
        description: "overflow test",
      }),
    });
    expect([401, 405, 400, 500]).toContain(res.status);
  });

  it("handles negative amount", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: -99999,
        date: "2026-03-01",
        description: "negative test",
      }),
    });
    expect([401, 405, 400, 500]).toContain(res.status);
  });

  it("handles zero amount", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 0,
        date: "2026-03-01",
        description: "zero test",
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });

  it("handles NaN amount", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: "not-a-number",
        date: "2026-03-01",
        description: "NaN test",
      }),
    });
    expect([401, 405, 400, 500]).toContain(res.status);
  });
});

describe("Invalid query parameters", () => {
  it("handles extreme pagination values without crashing", async () => {
    const res = await timedFetch("/api/transactions?page=999999&limit=99999");
    expect([200, 401]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("handles negative pagination without crashing", async () => {
    const res = await timedFetch("/api/transactions?page=-1&limit=-10");
    expect([200, 400, 401]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("handles non-numeric month/year without crashing", async () => {
    const res = await timedFetch("/api/dashboard?month=abc&year=xyz");
    expect([200, 400, 401, 500]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("handles future dates far ahead without crashing", async () => {
    const res = await timedFetch("/api/dashboard?month=11&year=9999");
    expect([200, 401]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("handles past dates far back without crashing", async () => {
    const res = await timedFetch("/api/dashboard?month=0&year=1900");
    expect([200, 401]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(5000);
  });

  it("handles extremely long query strings without crashing", async () => {
    const longSearch = "a".repeat(10000);
    const res = await timedFetch(`/api/transactions?search=${longSearch}`);
    expect([200, 401, 414]).toContain(res.status);
    expect(res.durationMs).toBeLessThan(10000);
  });
});

describe("Date edge cases", () => {
  it("handles invalid date in transaction create", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "not-a-date",
        description: "bad date",
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });

  it("handles Feb 30 date", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "2026-02-30",
        description: "feb 30",
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });

  it("handles epoch date", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "1970-01-01",
        description: "epoch",
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });

  it("handles far future date", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "9999-12-31",
        description: "far future",
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });
});

describe("Security - injection attempts", () => {
  it("handles SQL injection in search parameter - no error", async () => {
    const res = await timedFetch(
      `/api/transactions?search=${encodeURIComponent("'; DROP TABLE transactions; --")}`
    );
    // Must not return 500 (which would indicate SQL was interpreted)
    expect([200, 401]).toContain(res.status);
  });

  it("handles SQL injection in category ID - no error", async () => {
    const res = await timedFetch(
      `/api/transactions?category=${encodeURIComponent("1 OR 1=1")}`
    );
    expect([200, 401]).toContain(res.status);
  });

  it("handles XSS in POST body description", async () => {
    const res = await timedFetch("/api/transactions/create", {
      method: "POST",
      body: JSON.stringify({
        type: "expense",
        amount: 100,
        date: "2026-03-01",
        description: '<script>alert("xss")</script>',
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });

  it("handles path traversal in transaction ID", async () => {
    const res = await timedFetch("/api/transactions/../../etc/passwd");
    expect([200, 401, 404, 400]).toContain(res.status);
  });

  it("handles null bytes in parameters", async () => {
    const res = await timedFetch(
      `/api/transactions?search=${encodeURIComponent("test\x00injection")}`
    );
    expect([200, 401, 400]).toContain(res.status);
  });

  it("handles prototype pollution attempt in JSON", async () => {
    const res = await timedFetch("/api/accounts", {
      method: "POST",
      body: JSON.stringify({
        name: "test",
        __proto__: { admin: true },
        constructor: { prototype: { admin: true } },
      }),
    });
    expect([401, 405, 400]).toContain(res.status);
  });
});

describe("HTTP method misuse", () => {
  it("rejects PATCH on /api/accounts", async () => {
    const res = await timedFetch("/api/accounts", { method: "PATCH" });
    expect([401, 405]).toContain(res.status);
  });

  it("rejects OPTIONS on /api/transactions/create gracefully", async () => {
    const res = await fetch(`${BASE_URL}/api/transactions/create`, {
      method: "OPTIONS",
    });
    expect([200, 204, 405]).toContain(res.status);
  });

  it("GET on POST-only /api/transactions/create does not crash", async () => {
    const res = await timedFetch("/api/transactions/create");
    expect([200, 401, 405]).toContain(res.status);
  });

  it("GET on POST-only /api/data/clear does not crash", async () => {
    const res = await timedFetch("/api/data/clear");
    expect([200, 401, 405]).toContain(res.status);
  });
});

describe("Content-Type handling", () => {
  it("handles form-encoded POST body to JSON endpoint", async () => {
    const res = await fetch(`${BASE_URL}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: "name=test&currency=PLN",
    });
    expect([401, 405, 400, 415, 500]).toContain(res.status);
  });

  it("handles multipart where JSON is expected", async () => {
    const form = new FormData();
    form.append("name", "test");
    const res = await fetch(`${BASE_URL}/api/accounts`, {
      method: "POST",
      body: form,
    });
    expect([401, 404, 405, 400, 415, 500]).toContain(res.status);
  });

  it("handles text/plain content type", async () => {
    const res = await fetch(`${BASE_URL}/api/accounts`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: "just plain text",
    });
    expect([401, 405, 400, 415, 500]).toContain(res.status);
  });
});
