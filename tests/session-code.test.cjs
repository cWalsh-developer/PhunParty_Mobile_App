const assert = require("node:assert/strict");
const test = require("node:test");
const { extractSessionCode } = require("../utils/session-code.ts");

test("normalizes raw room codes without changing their nine-character identity", () => {
  assert.equal(extractSessionCode("ABC123DEF"), "ABC123DEF");
  assert.equal(extractSessionCode("abc123def"), "ABC123DEF");
  assert.equal(extractSessionCode("  aBc123dEf\n"), "ABC123DEF");
});

test("extracts complete room codes from join links and hash routes", () => {
  for (const link of [
    "https://phun.party/join/ABC123DEF",
    "https://phun.party/join/abc123def?source=qr",
    "https://phun.party/#/join/aBc123dEf",
    "https://phun.party/#/join/ABC123DEF?source=qr",
    "https://phun.party/join/ABC123DEF/",
  ]) {
    assert.equal(extractSessionCode(link), "ABC123DEF", link);
  }
});

test("accepts string session codes from JSON QR payloads", () => {
  assert.equal(extractSessionCode('{"session_code":"ABC123DEF"}'), "ABC123DEF");
  assert.equal(extractSessionCode('{"session_code":" abc123def "}'), "ABC123DEF");
});

test("rejects malformed codes instead of truncating them into another room", () => {
  for (const input of [
    "",
    "ABC123DE",
    "ABC123DEFX",
    "ABC 23DEF",
    "ABC-23DEF",
    "https://phun.party/join/ABC123DE",
    "https://phun.party/join/ABC123DEFX",
    "https://phun.party/join/ABC123DEFX?source=qr",
    "https://phun.party/#/join/ABC123DEF-extra",
    '{"session_code":"ABC123DEFX"}',
  ]) {
    assert.equal(extractSessionCode(input), null, input);
  }
});

test("rejects unrelated QR data, malformed JSON and non-string session codes", () => {
  for (const input of [
    "https://example.com/",
    "https://phun.party/",
    '{"session_code":',
    '{"room_code":"ABC123DEF"}',
    '{"session_code":123456789}',
    '{"session_code":null}',
    '{"session_code":["ABC123DEF"]}',
    "null",
    "[]",
  ]) {
    assert.equal(extractSessionCode(input), null, input);
  }
});
