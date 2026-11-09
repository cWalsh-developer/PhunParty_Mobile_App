export const SESSION_CODE_LENGTH = 9;

function normalizeSessionCode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const code = value.trim().toUpperCase();
  return /^[A-Z0-9]{9}$/.test(code) ? code : null;
}

/** Accept the raw code, a /join/ link (including hash routes), or a JSON QR. */
export function extractSessionCode(value: string): string | null {
  const data = value.trim();
  const directCode = normalizeSessionCode(data);
  if (directCode) return directCode;

  // Consume the entire path segment so a longer code cannot be truncated into
  // a different valid room. Query strings and hash-route links remain valid.
  const pathCode = data.match(/\/join\/([^/?#\s]+)(?:[/?#]|$)/i)?.[1];
  if (pathCode) return normalizeSessionCode(pathCode);

  try {
    const parsed: unknown = JSON.parse(data);
    if (parsed && typeof parsed === "object" && "session_code" in parsed) {
      return normalizeSessionCode(parsed.session_code);
    }
  } catch {
    // Other QR payloads do not identify a PhunParty room.
  }

  return null;
}
