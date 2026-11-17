/** Escapes %, _ and \ so user text is matched literally inside LIKE / ILIKE. */
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}
