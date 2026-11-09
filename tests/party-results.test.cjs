const assert = require("node:assert/strict");
const test = require("node:test");
const {
  normalizePartyResults,
  rankPartyResults,
} = require("../utils/party-results.ts");

test("normalizes only declared score fields and preserves equal-score order", () => {
  const payload = [
    { player_id: " low ", display_name: "  Lee  ", score: 4 },
    { player_id: "first", roster_player_id: " roster-1 ", display_name: "Jules", score: 12 },
    { player_id: "second", display_name: "Sam", score: 12 },
    { player_id: "unnamed", display_name: " ", score: 0 },
  ];
  const snapshot = JSON.stringify(payload);

  assert.deepEqual(normalizePartyResults(payload), [
    { playerId: "first", rosterPlayerId: "roster-1", displayName: "Jules", score: 12 },
    { playerId: "second", displayName: "Sam", score: 12 },
    { playerId: "low", displayName: "Lee", score: 4 },
    { playerId: "unnamed", displayName: "Player", score: 0 },
  ]);
  assert.equal(JSON.stringify(payload), snapshot);
});

test("rejects invalid identity, nonfinite scores, coercions and alternate fields", () => {
  assert.deepEqual(normalizePartyResults([
    null,
    "bad",
    {},
    { player_id: "", score: 4 },
    { player_id: 12, score: 4 },
    { player_id: "number-string", score: "12" },
    { player_id: "infinite", score: Infinity },
    { player_id: "nan", score: NaN },
    { playerId: "alias", score: 12 },
    { player_id: "points", points: 12 },
  ]), []);
  assert.deepEqual(normalizePartyResults({ final_results: [] }), []);
  assert.deepEqual(normalizePartyResults(undefined), []);
});

test("keeps genuine zero and negative scores without inventing optional values", () => {
  assert.deepEqual(normalizePartyResults([
    { player_id: "negative", score: -2, display_name: 123, roster_player_id: false },
    { player_id: "zero", score: 0 },
  ]), [
    { playerId: "zero", displayName: "Player", score: 0 },
    { playerId: "negative", displayName: "Player", score: -2 },
  ]);
});

test("ranks ties as 1, 1, 3 and keeps the original results unchanged", () => {
  const results = [
    { playerId: "third", displayName: "Lee", score: 4 },
    { playerId: "first", displayName: "Jules", score: 12 },
    { playerId: "second", displayName: "Sam", score: 12 },
    { playerId: "last", displayName: "Pat", score: 0 },
  ];
  const snapshot = JSON.stringify(results);

  assert.deepEqual(rankPartyResults(results).map(({ playerId, rank }) => [playerId, rank]), [
    ["first", 1], ["second", 1], ["third", 3], ["last", 4],
  ]);
  assert.equal(JSON.stringify(results), snapshot);
  assert.deepEqual(rankPartyResults([]), []);
});
