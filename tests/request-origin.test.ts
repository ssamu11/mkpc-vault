import { test } from "node:test";
import assert from "node:assert/strict";
import { hasValidOrigin } from "../lib/request-origin";

test("origin check uses public host instead of Next internal request URL", () => {
  assert.equal(hasValidOrigin(new Request('http://localhost:3100/api/catalog', {
    headers: { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100' },
  })), true);
  assert.equal(hasValidOrigin(new Request('http://localhost:3100/api/catalog', {
    headers: { host: 'localhost:3100', 'x-forwarded-host': 'vault.example.com', 'x-forwarded-proto': 'https', origin: 'https://vault.example.com' },
  })), true);
});

test("origin check rejects another domain, port, protocol and malformed origins", () => {
  for (const origin of ['https://attacker.example', 'http://127.0.0.1:3101', 'https://127.0.0.1:3100', 'null', 'not a URL']) {
    assert.equal(hasValidOrigin(new Request('http://localhost:3100/api/catalog', {
      headers: { host: '127.0.0.1:3100', origin },
    })), false, origin);
  }
  assert.equal(hasValidOrigin(new Request('http://localhost:3100/api/catalog', {
    headers: { host: '127.0.0.1:3100', origin: 'http://127.0.0.1:3100', 'x-forwarded-host': 'evil.example,127.0.0.1:3100' },
  })), false);
});

test("origin check preserves non-browser requests without an origin", () => {
  assert.equal(hasValidOrigin(new Request('http://127.0.0.1:3100/api/catalog')), true);
});
