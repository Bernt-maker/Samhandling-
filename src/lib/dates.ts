import type { Duty, Member } from '../types';

/** YYYY-MM-DD i lokal tid. */
export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + days);
  return dateKey(d);
}

/** Mandag i uka datoen ligger i. */
export function mondayOf(key: string): string {
  const d = parseDateKey(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

export function isoWeek(key: string): number {
  const d = parseDateKey(key);
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
}

/** Datoene i månedsrutenettet (starter på mandag, 6 uker). */
export function monthGrid(year: number, month: number): string[] {
  const first = dateKey(new Date(year, month, 1));
  const start = mondayOf(first);
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

export function dutyOn(duties: Duty[], key: string): Duty | undefined {
  return duties.find((d) => d.startDate <= key && key <= d.endDate);
}

export interface RotationInput {
  startDate: string;
  periodDays: number;
  periods: number;
  order: Member[];
}

/** Lager en turnus: hver person får en periode etter tur. */
export function buildRotation({ startDate, periodDays, periods, order }: RotationInput) {
  if (order.length === 0 || periodDays < 1 || periods < 1) return [];
  return Array.from({ length: periods }, (_, i) => ({
    startDate: addDays(startDate, i * periodDays),
    endDate: addDays(startDate, i * periodDays + periodDays - 1),
    memberId: order[i % order.length].id,
  }));
}

export const fmt = {
  weekdayDate: (d: Date) =>
    d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }),
  shortDate: (d: Date) => d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' }),
  time: (d: Date) => d.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' }),
  monthYear: (y: number, m: number) =>
    new Date(y, m, 1).toLocaleDateString('nb-NO', { month: 'long', year: 'numeric' }),
  dateTime: (d: Date) =>
    d.toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
};

export function range(a: string, b: string): string {
  const da = parseDateKey(a);
  const db = parseDateKey(b);
  if (a === b) return fmt.shortDate(da);
  return `${fmt.shortDate(da)} – ${fmt.shortDate(db)}`;
}

/** Verdi for <input type="datetime-local"> fra en ISO-streng. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${dateKey(d)}T${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/[,;]/g, (c) => `\\${c}`);
}

export function buildIcs(ev: { id: string; start: Date; minutes: number; title: string; location: string; description: string }): string {
  const end = new Date(ev.start.getTime() + ev.minutes * 60000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Mors kalender//NO',
    'BEGIN:VEVENT',
    `UID:${ev.id}@mors-kalender`,
    `DTSTAMP:${icsStamp(new Date())}`,
    `DTSTART:${icsStamp(ev.start)}`,
    `DTEND:${icsStamp(end)}`,
    `SUMMARY:${icsEscape(ev.title)}`,
    `LOCATION:${icsEscape(ev.location)}`,
    `DESCRIPTION:${icsEscape(ev.description)}`,
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${icsEscape(ev.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n');
}
