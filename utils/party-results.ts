export interface PartyResult {
  playerId: string;
  rosterPlayerId?: string;
  displayName: string;
  score: number;
}

export interface PartyStanding extends PartyResult {
  rank: number;
}

/** Read the declared SessionScore fields without guessing alternate payloads. */
export function normalizePartyResults(value: unknown): PartyResult[] {
  if (!Array.isArray(value)) return [];

  const results: PartyResult[] = [];

  for (const entry of value) {
    if (typeof entry !== "object" || entry === null) continue;

    const row = entry as Record<string, unknown>;
    if (
      typeof row.player_id !== "string" ||
      !row.player_id.trim() ||
      typeof row.score !== "number" ||
      !Number.isFinite(row.score)
    ) {
      continue;
    }

    const rosterPlayerId =
      typeof row.roster_player_id === "string"
        ? row.roster_player_id.trim()
        : "";
    const displayName =
      typeof row.display_name === "string" ? row.display_name.trim() : "";

    results.push({
      playerId: row.player_id.trim(),
      ...(rosterPlayerId ? { rosterPlayerId } : {}),
      displayName: displayName || "Player",
      score: row.score,
    });
  }

  // Array#sort is stable, so players with equal scores keep the server's order.
  return results.sort((first, second) => second.score - first.score);
}

/** Competition ranking: two players tied first are followed by third place. */
export function rankPartyResults(results: readonly PartyResult[]): PartyStanding[] {
  const sorted = [...results].sort((first, second) => second.score - first.score);
  let rank = 0;

  return sorted.map((result, index) => {
    if (index === 0 || result.score !== sorted[index - 1].score) {
      rank = index + 1;
    }

    return { ...result, rank };
  });
}
