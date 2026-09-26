import { describe, expect, it } from 'vitest';
import { createVault, decryptJson, encryptJson, openVault, passphraseProblem } from '../src/lib/crypto';

// Færre runder i test for fart; produksjon bruker 600 000
const IT = 100_000;

describe('crypto', () => {
  it('åpner hvelvet med riktig passord og avviser feil', async () => {
    const { row } = await createVault('korrekt hest batteri stift', IT);
    expect(await openVault('korrekt hest batteri stift', row)).not.toBeNull();
    expect(await openVault('feil passord her!!', row)).toBeNull();
  });

  it('krypterer og dekrypterer rundt', async () => {
    const { key } = await createVault('korrekt hest batteri stift', IT);
    const sealed = await encryptJson(key, { title: 'Tannlege', notes: 'æøå' }, 'appointments:1');
    expect(sealed.ct).not.toContain('Tannlege');
    expect(await decryptJson(key, sealed, 'appointments:1')).toEqual({ title: 'Tannlege', notes: 'æøå' });
  });

  it('avviser kryptert innhold flyttet til en annen rad', async () => {
    const { key } = await createVault('korrekt hest batteri stift', IT);
    const sealed = await encryptJson(key, { a: 1 }, 'appointments:1');
    await expect(decryptJson(key, sealed, 'appointments:2')).rejects.toThrow();
  });

  it('bruker ny IV hver gang', async () => {
    const { key } = await createVault('korrekt hest batteri stift', IT);
    const a = await encryptJson(key, 'x', 'a');
    const b = await encryptJson(key, 'x', 'a');
    expect(a.iv).not.toBe(b.iv);
    expect(a.ct).not.toBe(b.ct);
  });

  it('krever et sterkt nok familiepassord', () => {
    expect(passphraseProblem('kort')).not.toBeNull();
    expect(passphraseProblem('aaaaaaaaaaaaaaa')).not.toBeNull();
    expect(passphraseProblem('mor har time hos tannlegen')).toBeNull();
  });
});
