export type Role = 'admin' | 'familie' | 'lege';

export interface Member {
  id: string;
  email: string;
  name: string;
  role: Role;
  color: string;
}

export type AppointmentKind =
  | 'lege'
  | 'tannlege'
  | 'audiolog'
  | 'oye'
  | 'sykehus'
  | 'fysio'
  | 'annet';

export type AppointmentStatus = 'planlagt' | 'gjennomfort' | 'avlyst';

/** Alt i denne strukturen krypteres før det lagres. */
export interface AppointmentData {
  kind: AppointmentKind;
  title: string;
  practitioner: string;
  location: string;
  durationMin: number;
  escortId: string | null;
  transport: string;
  notes: string;
  status: AppointmentStatus;
}

export interface Appointment {
  id: string;
  startsAt: string;
  data: AppointmentData;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}

export interface Duty {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  memberId: string;
  note: string;
  updatedBy: string;
}

export interface Comment {
  id: string;
  appointmentId: string;
  text: string;
  author: string;
  createdAt: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  actor: string;
  tableName: string;
  rowId: string;
  action: string;
}

/* Rader slik de ligger i databasen (kryptert innhold i iv/ct). */

export interface VaultRow {
  salt: string;
  iterations: number;
  check_iv: string;
  check_ct: string;
}

export interface AppointmentRow {
  id: string;
  starts_at: string;
  iv: string;
  ct: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
}

export interface DutyRow {
  id: string;
  start_date: string;
  end_date: string;
  member_id: string;
  iv: string | null;
  ct: string | null;
  updated_by?: string;
}

export interface CommentRow {
  id: string;
  appointment_id: string;
  iv: string;
  ct: string;
  author?: string;
  created_at?: string;
}

export interface AuditRow {
  id: number;
  at: string;
  actor: string;
  table_name: string;
  row_id: string;
  action: string;
}

export type TableName = 'members' | 'appointments' | 'duties' | 'comments' | 'events';

export type EventKind =
  | 'innleggelse'
  | 'legevakt'
  | 'telefon'
  | 'besok'
  | 'hjemmetjeneste'
  | 'medisin'
  | 'fall'
  | 'helse'
  | 'annet';

/** Alt i denne strukturen krypteres før det lagres. */
export interface LogEventData {
  kind: EventKind;
  title: string;
  text: string;
  /** Sluttdato (YYYY-MM-DD), f.eks. utskrivning. Tom = pågår/ikke relevant. */
  endDate: string;
  important: boolean;
}

export interface LogEvent {
  id: string;
  occurredAt: string;
  data: LogEventData;
  createdBy: string;
  updatedBy: string;
  updatedAt: string;
}

export interface EventRow {
  id: string;
  occurred_at: string;
  iv: string;
  ct: string;
  created_by?: string;
  updated_by?: string;
  updated_at?: string;
}
