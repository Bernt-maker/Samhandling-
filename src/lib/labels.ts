import type { AppointmentData, AppointmentKind, AppointmentStatus, EventKind, LogEventData, Member, Role } from '../types';

export const KIND_LABEL: Record<AppointmentKind, string> = {
  lege: 'Fastlege / lege',
  tannlege: 'Tannlege',
  audiolog: 'Audiolog / hørsel',
  oye: 'Øyelege / optiker',
  sykehus: 'Sykehus / poliklinikk',
  fysio: 'Fysioterapi',
  annet: 'Annet',
};

export const KIND_ICON: Record<AppointmentKind, string> = {
  lege: '🩺',
  tannlege: '🦷',
  audiolog: '👂',
  oye: '👁️',
  sykehus: '🏥',
  fysio: '🦵',
  annet: '📌',
};

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  planlagt: 'Planlagt',
  gjennomfort: 'Gjennomført',
  avlyst: 'Avlyst',
};

export const ROLE_LABEL: Record<Role, string> = {
  admin: 'Administrator',
  familie: 'Familie',
  lege: 'Lege (lese + kommentere)',
};

export const COLORS = ['#2f5d62', '#b5523b', '#6b4f9e', '#c28a1e', '#3a7d44', '#2d6cb5', '#a33d6b', '#5c5c5c'];

export function emptyAppointment(): AppointmentData {
  return {
    kind: 'lege',
    title: '',
    practitioner: '',
    location: '',
    durationMin: 30,
    escortId: null,
    transport: '',
    notes: '',
    status: 'planlagt',
  };
}

export function appointmentTitle(d: AppointmentData): string {
  return d.title.trim() || KIND_LABEL[d.kind];
}

export function nameOf(members: Member[], idOrEmail: string | null | undefined): string {
  if (!idOrEmail) return '';
  const m = members.find((x) => x.id === idOrEmail || x.email === idOrEmail);
  return m?.name ?? idOrEmail;
}

export const EVENT_LABEL: Record<EventKind, string> = {
  innleggelse: 'Sykehusinnleggelse',
  legevakt: 'Legevakt / akutt',
  telefon: 'Telefonsamtale',
  besok: 'Besøk',
  hjemmetjeneste: 'Hjemmetjeneste / helsepersonell',
  medisin: 'Medisinendring',
  fall: 'Fall / skade',
  helse: 'Helse / observasjon',
  annet: 'Annet',
};

export const EVENT_ICON: Record<EventKind, string> = {
  innleggelse: '🏥',
  legevakt: '🚑',
  telefon: '📞',
  besok: '🏠',
  hjemmetjeneste: '🧑‍⚕️',
  medisin: '💊',
  fall: '⚠️',
  helse: '🩺',
  annet: '📝',
};

export function emptyEvent(): LogEventData {
  return { kind: 'telefon', title: '', text: '', endDate: '', important: false };
}

export function eventTitle(d: LogEventData): string {
  return d.title.trim() || EVENT_LABEL[d.kind];
}
