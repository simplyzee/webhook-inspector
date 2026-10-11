import { randomBytes } from "node:crypto";

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789"; // no 0/o/1/l

/** Unguessable id: 12 chars from a 32-char alphabet = 60 bits. */
export function newId(length = 12): string {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

export function isValidId(id: string): boolean {
  return /^[a-z0-9]{6,32}$/.test(id);
}
