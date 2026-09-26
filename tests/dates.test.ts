import { describe, expect, it } from 'vitest';
import { addDays, buildIcs, buildRotation, dutyOn, isoWeek, mondayOf, monthGrid } from '../src/lib/dates';
import type { Member } from '../src/types';

const m = (id: string): Member => ({ id, email: `${id}@x.no`, name: id, role: 'familie', color: '#000000' });

describe('dates', () => {
  it('finner mandag og ukenummer', () => {
    expect(mondayOf('2026-09-26')).toBe('2026-09-21');
    expect(mondayOf('2026-09-21')).toBe('2026-09-21');
    expect(isoWeek('2026-09-26')).toBe(39);
    expect(isoWeek('2027-01-01')).toBe(53);
    expect(isoWeek('2026-01-01')).toBe(1);
  });

  it('håndterer månedsskifte og sommertid', () => {
    expect(addDays('2026-10-24', 7)).toBe('2026-10-31');
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-03-29', 1)).toBe('2026-03-30');
  });

  it('lager månedsrutenett som starter på mandag', () => {
    const g = monthGrid(2026, 8); // september 2026
    expect(g).toHaveLength(42);
    expect(g[0]).toBe('2026-08-31');
    expect(g).toContain('2026-09-30');
  });

  it('lager turnus etter tur', () => {
    const r = buildRotation({ startDate: '2026-09-28', periodDays: 7, periods: 5, order: [m('a'), m('b'), m('c'), m('d')] });
    expect(r.map((x) => x.memberId)).toEqual(['a', 'b', 'c', 'd', 'a']);
    expect(r[0]).toMatchObject({ startDate: '2026-09-28', endDate: '2026-10-04' });
    expect(r[4]).toMatchObject({ startDate: '2026-10-26', endDate: '2026-11-01' });
  });

  it('finner hvem som har vakt en gitt dag', () => {
    const duties = [
      { id: '1', startDate: '2026-09-21', endDate: '2026-09-27', memberId: 'a', note: '', updatedBy: '' },
      { id: '2', startDate: '2026-09-28', endDate: '2026-10-04', memberId: 'b', note: '', updatedBy: '' },
    ];
    expect(dutyOn(duties, '2026-09-27')?.memberId).toBe('a');
    expect(dutyOn(duties, '2026-09-28')?.memberId).toBe('b');
    expect(dutyOn(duties, '2026-10-05')).toBeUndefined();
  });

  it('lager gyldig ics', () => {
    const ics = buildIcs({ id: 'x', start: new Date('2026-10-01T08:00:00Z'), minutes: 30, title: 'Mor: tannlege, kontroll', location: 'Gate 1', description: 'a\nb' });
    expect(ics).toContain('DTSTART:20261001T080000Z');
    expect(ics).toContain('DTEND:20261001T083000Z');
    expect(ics).toContain('SUMMARY:Mor: tannlege\\, kontroll');
  });
});
