import { describe, expect, it } from 'vitest';
import { cleanEnv } from '../src/lib/backend';

describe('cleanEnv', () => {
  it('fjerner "NAVN=" foran verdien', () => {
    expect(cleanEnv('NEXT_PUBLIC_SUPABASE_URL=https://abc.supabase.co')).toBe('https://abc.supabase.co');
    expect(cleanEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_x_Y')).toBe('sb_publishable_x_Y');
  });
  it('fjerner mellomrom, anførselstegn og skråstrek til slutt', () => {
    expect(cleanEnv('  "https://abc.supabase.co/" \n')).toBe('https://abc.supabase.co');
  });
  it('lar vanlige verdier være', () => {
    expect(cleanEnv('sb_publishable_abc')).toBe('sb_publishable_abc');
    expect(cleanEnv(undefined)).toBe('');
  });
});
