/**
 * Ende-til-ende-kryptering.
 *
 * Familien deler ett familiepassord. Fra passordet avledes en AES-256-GCM-
 * nøkkel i nettleseren (PBKDF2-SHA256, 600 000 runder). Alt sensitivt
 * innhold krypteres med denne før det sendes til serveren, så verken
 * databasen, Supabase eller noen som får tak i en sikkerhetskopi kan lese
 * hva som står i kalenderen.
 *
 * Hver kryptert verdi bindes til tabell og rad-id (AAD), slik at kryptert
 * innhold ikke kan flyttes mellom rader uten at det oppdages.
 */
import type { VaultRow } from '../types';

export const PBKDF2_ITERATIONS = 600_000;
const CHECK_TEXT = 'mors-kalender:v1';
const CHECK_AAD = 'vault:check';

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

export function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(
  passphrase: string,
  saltB64: string,
  iterations: number,
): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase.normalize('NFC')),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: fromB64(saltB64), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false, // nøkkelen kan ikke eksporteres ut av nettleseren
    ['encrypt', 'decrypt'],
  );
}

export interface Sealed {
  iv: string;
  ct: string;
}

export async function encryptText(key: CryptoKey, text: string, aad: string): Promise<Sealed> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: enc.encode(aad) },
    key,
    enc.encode(text),
  );
  return { iv: toB64(iv), ct: toB64(new Uint8Array(ct)) };
}

export async function decryptText(key: CryptoKey, sealed: Sealed, aad: string): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromB64(sealed.iv), additionalData: enc.encode(aad) },
    key,
    fromB64(sealed.ct),
  );
  return dec.decode(pt);
}

export async function encryptJson(key: CryptoKey, value: unknown, aad: string): Promise<Sealed> {
  return encryptText(key, JSON.stringify(value), aad);
}

export async function decryptJson<T>(key: CryptoKey, sealed: Sealed, aad: string): Promise<T> {
  return JSON.parse(await decryptText(key, sealed, aad)) as T;
}

/** Krav til familiepassordet. Returnerer en feilmelding, eller null hvis ok. */
export function passphraseProblem(passphrase: string): string | null {
  if (passphrase.length < 12) return 'Familiepassordet må ha minst 12 tegn.';
  if (new Set(passphrase).size < 6) return 'Familiepassordet er for ensformig.';
  return null;
}

export async function createVault(
  passphrase: string,
  iterations = PBKDF2_ITERATIONS,
): Promise<{ row: VaultRow; key: CryptoKey }> {
  const salt = toB64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(passphrase, salt, iterations);
  const check = await encryptText(key, CHECK_TEXT, CHECK_AAD);
  return {
    row: { salt, iterations, check_iv: check.iv, check_ct: check.ct },
    key,
  };
}

/** Returnerer nøkkelen hvis passordet er riktig, ellers null. */
export async function openVault(passphrase: string, row: VaultRow): Promise<CryptoKey | null> {
  const key = await deriveKey(passphrase, row.salt, row.iterations);
  try {
    const text = await decryptText(key, { iv: row.check_iv, ct: row.check_ct }, CHECK_AAD);
    return text === CHECK_TEXT ? key : null;
  } catch {
    return null;
  }
}
