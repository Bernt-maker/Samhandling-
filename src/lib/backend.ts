import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type {
  AppointmentRow,
  AuditRow,
  CommentRow,
  EventRow,
  DutyRow,
  Member,
  TableName,
  VaultRow,
} from '../types';

/**
 * Alt appen trenger fra serveren. Supabase-varianten er den ekte; demo-
 * varianten lagrer i nettleseren og brukes bare til å prøve appen.
 */
export interface Backend {
  readonly demo: boolean;
  currentEmail(): Promise<string | null>;
  onAuthChange(cb: (email: string | null) => void): () => void;
  sendCode(email: string): Promise<void>;
  verifyCode(email: string, code: string): Promise<void>;
  signOut(): Promise<void>;

  listMembers(): Promise<Member[]>;
  saveMember(m: Omit<Member, 'id'> & { id?: string }): Promise<void>;
  deleteMember(id: string): Promise<void>;

  getVault(): Promise<VaultRow | null>;
  createVault(row: VaultRow): Promise<void>;

  listAppointments(): Promise<AppointmentRow[]>;
  saveAppointment(row: AppointmentRow): Promise<void>;
  deleteAppointment(id: string): Promise<void>;

  listDuties(): Promise<DutyRow[]>;
  saveDuties(rows: DutyRow[]): Promise<void>;
  deleteDuty(id: string): Promise<void>;

  listComments(): Promise<CommentRow[]>;
  addComment(row: CommentRow): Promise<void>;
  deleteComment(id: string): Promise<void>;

  listEvents(): Promise<EventRow[]>;
  saveEvent(row: EventRow): Promise<void>;
  deleteEvent(id: string): Promise<void>;

  listAudit(limit: number): Promise<AuditRow[]>;

  /** Kalles når noen (også andre familiemedlemmer) endrer noe. */
  subscribe(cb: (table: TableName) => void): () => void;
}

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

class SupabaseBackend implements Backend {
  readonly demo = false;
  private sb: SupabaseClient;

  constructor(url: string, anonKey: string) {
    this.sb = createClient(url, anonKey, {
      // detectSessionInUrl: e-poster med lenke i stedet for kode fungerer også
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  async currentEmail() {
    const { data } = await this.sb.auth.getSession();
    return data.session?.user.email?.toLowerCase() ?? null;
  }

  onAuthChange(cb: (email: string | null) => void) {
    const { data } = this.sb.auth.onAuthStateChange((_e, session) => {
      cb(session?.user.email?.toLowerCase() ?? null);
    });
    return () => data.subscription.unsubscribe();
  }

  async sendCode(email: string) {
    const { error } = await this.sb.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        // Lenker i e-posten skal peke tilbake hit, ikke til Supabase sin standardadresse
        emailRedirectTo: location.origin + location.pathname,
      },
    });
    if (error) throw new Error(error.message);
  }

  async verifyCode(email: string, code: string) {
    const { error } = await this.sb.auth.verifyOtp({ email, token: code, type: 'email' });
    if (error) throw new Error(error.message);
  }

  async signOut() {
    await this.sb.auth.signOut();
  }

  async listMembers() {
    return check(await this.sb.from('members').select('id,email,name,role,color').order('name')) as Member[];
  }
  async saveMember(m: Omit<Member, 'id'> & { id?: string }) {
    const row = { ...m, email: m.email.trim().toLowerCase() };
    if (row.id) check(await this.sb.from('members').update(row).eq('id', row.id));
    else check(await this.sb.from('members').insert(row));
  }
  async deleteMember(id: string) {
    check(await this.sb.from('members').delete().eq('id', id));
  }

  async getVault() {
    const rows = check(
      await this.sb.from('vault').select('salt,iterations,check_iv,check_ct').limit(1),
    ) as VaultRow[];
    return rows[0] ?? null;
  }
  async createVault(row: VaultRow) {
    check(await this.sb.from('vault').insert({ id: 1, ...row }));
  }

  async listAppointments() {
    return check(
      await this.sb
        .from('appointments')
        .select('id,starts_at,iv,ct,created_by,updated_by,updated_at')
        .order('starts_at'),
    ) as AppointmentRow[];
  }
  async saveAppointment(row: AppointmentRow) {
    const { id, starts_at, iv, ct } = row;
    check(await this.sb.from('appointments').upsert({ id, starts_at, iv, ct }));
  }
  async deleteAppointment(id: string) {
    check(await this.sb.from('appointments').delete().eq('id', id));
  }

  async listDuties() {
    return check(
      await this.sb
        .from('duties')
        .select('id,start_date,end_date,member_id,iv,ct,updated_by')
        .order('start_date'),
    ) as DutyRow[];
  }
  async saveDuties(rows: DutyRow[]) {
    const clean = rows.map(({ id, start_date, end_date, member_id, iv, ct }) => ({
      id, start_date, end_date, member_id, iv, ct,
    }));
    check(await this.sb.from('duties').upsert(clean));
  }
  async deleteDuty(id: string) {
    check(await this.sb.from('duties').delete().eq('id', id));
  }

  async listComments() {
    return check(
      await this.sb
        .from('comments')
        .select('id,appointment_id,iv,ct,author,created_at')
        .order('created_at'),
    ) as CommentRow[];
  }
  async addComment(row: CommentRow) {
    const { id, appointment_id, iv, ct } = row;
    check(await this.sb.from('comments').insert({ id, appointment_id, iv, ct }));
  }
  async deleteComment(id: string) {
    check(await this.sb.from('comments').delete().eq('id', id));
  }

  async listEvents() {
    return check(
      await this.sb
        .from('events')
        .select('id,occurred_at,iv,ct,created_by,updated_by,updated_at')
        .order('occurred_at', { ascending: false }),
    ) as EventRow[];
  }
  async saveEvent(row: EventRow) {
    const { id, occurred_at, iv, ct } = row;
    check(await this.sb.from('events').upsert({ id, occurred_at, iv, ct }));
  }
  async deleteEvent(id: string) {
    check(await this.sb.from('events').delete().eq('id', id));
  }

  async listAudit(limit: number) {
    return check(
      await this.sb.from('audit_log').select('*').order('at', { ascending: false }).limit(limit),
    ) as AuditRow[];
  }

  subscribe(cb: (table: TableName) => void) {
    const channel = this.sb.channel('family-changes');
    for (const table of ['members', 'appointments', 'duties', 'comments', 'events'] as TableName[]) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => cb(table));
    }
    channel.subscribe();
    return () => {
      void this.sb.removeChannel(channel);
    };
  }
}

/* ------------------------------------------------------------------ */
/* Demo: alt ligger i localStorage i denne nettleseren. Endringer        */
/* sendes til andre faner med BroadcastChannel, så man kan se sanntid.  */
/* ------------------------------------------------------------------ */

interface DemoDb {
  members: Member[];
  vault: VaultRow | null;
  appointments: AppointmentRow[];
  duties: DutyRow[];
  comments: CommentRow[];
  events?: EventRow[];
  audit: AuditRow[];
}

const DEMO_KEY = 'mors-kalender-demo-db';
const DEMO_SESSION = 'mors-kalender-demo-session';
export const DEMO_CODE = '123456';

class DemoBackend implements Backend {
  readonly demo = true;
  private channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('mors-kalender-demo') : null;
  private authListeners = new Set<(email: string | null) => void>();

  private load(): DemoDb {
    try {
      const raw = localStorage.getItem(DEMO_KEY);
      if (raw) return JSON.parse(raw) as DemoDb;
    } catch {
      /* start på nytt */
    }
    return { members: [], vault: null, appointments: [], duties: [], comments: [], audit: [] };
  }

  private save(db: DemoDb, table?: TableName, rowId?: string, action?: string) {
    const actor = this.email() ?? '';
    if (table && rowId && action) {
      db.audit.unshift({
        id: Date.now() + Math.random(),
        at: new Date().toISOString(),
        actor,
        table_name: table,
        row_id: rowId,
        action,
      });
      db.audit = db.audit.slice(0, 200);
    }
    localStorage.setItem(DEMO_KEY, JSON.stringify(db));
    if (table) {
      this.channel?.postMessage(table);
      this.local.forEach((cb) => cb(table));
    }
  }

  private local = new Set<(t: TableName) => void>();

  private email(): string | null {
    return localStorage.getItem(DEMO_SESSION);
  }

  private role() {
    const e = this.email();
    return this.load().members.find((m) => m.email === e)?.role ?? null;
  }

  private requireEdit() {
    const r = this.role();
    if (r !== 'admin' && r !== 'familie') throw new Error('Du har ikke tilgang til å endre dette.');
  }

  async currentEmail() {
    return this.email();
  }
  onAuthChange(cb: (email: string | null) => void) {
    this.authListeners.add(cb);
    return () => this.authListeners.delete(cb);
  }
  async sendCode(_email: string) {
    /* I demo er koden alltid 123456 */
  }
  async verifyCode(email: string, code: string) {
    if (code !== DEMO_CODE) throw new Error('Feil kode. I demo er koden 123456.');
    const e = email.trim().toLowerCase();
    const db = this.load();
    if (db.members.length === 0) {
      db.members.push({ id: crypto.randomUUID(), email: e, name: e.split('@')[0], role: 'admin', color: '#2f5d62' });
      this.save(db);
    }
    localStorage.setItem(DEMO_SESSION, e);
    this.authListeners.forEach((cb) => cb(e));
  }
  async signOut() {
    localStorage.removeItem(DEMO_SESSION);
    this.authListeners.forEach((cb) => cb(null));
  }

  async listMembers() {
    if (!this.role()) return [];
    return [...this.load().members].sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  }
  async saveMember(m: Omit<Member, 'id'> & { id?: string }) {
    if (this.role() !== 'admin') throw new Error('Bare administrator kan endre medlemmer.');
    const db = this.load();
    const email = m.email.trim().toLowerCase();
    if (db.members.some((x) => x.email === email && x.id !== m.id)) throw new Error('E-posten finnes allerede.');
    const id = m.id ?? crypto.randomUUID();
    db.members = db.members.filter((x) => x.id !== id).concat({ ...m, id, email });
    this.save(db, 'members', id, m.id ? 'update' : 'insert');
  }
  async deleteMember(id: string) {
    if (this.role() !== 'admin') throw new Error('Bare administrator kan endre medlemmer.');
    const db = this.load();
    db.members = db.members.filter((x) => x.id !== id || x.email === this.email());
    db.duties = db.duties.filter((d) => d.member_id !== id);
    this.save(db, 'members', id, 'delete');
  }

  async getVault() {
    return this.role() ? this.load().vault : null;
  }
  async createVault(row: VaultRow) {
    const db = this.load();
    if (db.vault) throw new Error('Familiepassord er allerede satt.');
    db.vault = row;
    this.save(db);
  }

  async listAppointments() {
    return this.role() ? this.load().appointments : [];
  }
  async saveAppointment(row: AppointmentRow) {
    this.requireEdit();
    const db = this.load();
    const old = db.appointments.find((a) => a.id === row.id);
    const stamped = {
      ...row,
      created_by: old?.created_by ?? this.email()!,
      updated_by: this.email()!,
      updated_at: new Date().toISOString(),
    };
    db.appointments = db.appointments.filter((a) => a.id !== row.id).concat(stamped);
    this.save(db, 'appointments', row.id, old ? 'update' : 'insert');
  }
  async deleteAppointment(id: string) {
    this.requireEdit();
    const db = this.load();
    db.appointments = db.appointments.filter((a) => a.id !== id);
    db.comments = db.comments.filter((c) => c.appointment_id !== id);
    this.save(db, 'appointments', id, 'delete');
  }

  async listDuties() {
    return this.role() ? this.load().duties : [];
  }
  async saveDuties(rows: DutyRow[]) {
    this.requireEdit();
    const db = this.load();
    const ids = new Set(rows.map((r) => r.id));
    db.duties = db.duties
      .filter((d) => !ids.has(d.id))
      .concat(rows.map((r) => ({ ...r, updated_by: this.email()! })));
    this.save(db, 'duties', rows.length === 1 ? rows[0].id : `${rows.length} vakter`, 'insert');
  }
  async deleteDuty(id: string) {
    this.requireEdit();
    const db = this.load();
    db.duties = db.duties.filter((d) => d.id !== id);
    this.save(db, 'duties', id, 'delete');
  }

  async listComments() {
    return this.role() ? this.load().comments : [];
  }
  async addComment(row: CommentRow) {
    if (!this.role()) throw new Error('Ingen tilgang.');
    const db = this.load();
    db.comments.push({ ...row, author: this.email()!, created_at: new Date().toISOString() });
    this.save(db, 'comments', row.id, 'insert');
  }
  async deleteComment(id: string) {
    const db = this.load();
    const c = db.comments.find((x) => x.id === id);
    if (!c) return;
    if (c.author !== this.email() && this.role() !== 'admin') throw new Error('Du kan bare slette egne kommentarer.');
    db.comments = db.comments.filter((x) => x.id !== id);
    this.save(db, 'comments', id, 'delete');
  }

  async listEvents() {
    return this.role() ? [...(this.load().events ?? [])].sort((a, b) => b.occurred_at.localeCompare(a.occurred_at)) : [];
  }
  async saveEvent(row: EventRow) {
    if (!this.role()) throw new Error('Ingen tilgang.');
    const db = this.load();
    const events = db.events ?? [];
    const old = events.find((e) => e.id === row.id);
    if (old && old.created_by !== this.email() && this.role() !== 'admin')
      throw new Error('Du kan bare endre egne hendelser.');
    db.events = events.filter((e) => e.id !== row.id).concat({
      ...row,
      created_by: old?.created_by ?? this.email()!,
      updated_by: this.email()!,
      updated_at: new Date().toISOString(),
    });
    this.save(db, 'events', row.id, old ? 'update' : 'insert');
  }
  async deleteEvent(id: string) {
    const db = this.load();
    const e = (db.events ?? []).find((x) => x.id === id);
    if (!e) return;
    if (e.created_by !== this.email() && this.role() !== 'admin') throw new Error('Du kan bare slette egne hendelser.');
    db.events = (db.events ?? []).filter((x) => x.id !== id);
    this.save(db, 'events', id, 'delete');
  }

  async listAudit(limit: number) {
    return this.role() ? this.load().audit.slice(0, limit) : [];
  }

  subscribe(cb: (table: TableName) => void) {
    const onMsg = (e: MessageEvent) => cb(e.data as TableName);
    this.channel?.addEventListener('message', onMsg);
    this.local.add(cb);
    return () => {
      this.channel?.removeEventListener('message', onMsg);
      this.local.delete(cb);
    };
  }
}

/**
 * Tåler at verdien er limt inn som hel linje fra Supabase, f.eks.
 * "NEXT_PUBLIC_SUPABASE_URL=https://…", eller med mellomrom/anførselstegn.
 */
export function cleanEnv(value: string | undefined): string {
  let v = (value ?? '').trim();
  const eq = v.indexOf('=');
  if (eq > 0 && /^[A-Z0-9_]+$/.test(v.slice(0, eq))) v = v.slice(eq + 1);
  return v.trim().replace(/^["']|["']$/g, '').replace(/\/+$/, '');
}

const url = cleanEnv(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const anonKey = cleanEnv(import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined);

export const isConfigured = Boolean(url && anonKey);

export function createBackend(demo: boolean): Backend | null {
  if (demo) return new DemoBackend();
  if (!url || !anonKey) return null;
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url)) {
    throw new Error(`Ugyldig Supabase-adresse: «${url}». Den skal se slik ut: https://xxxx.supabase.co`);
  }
  return new SupabaseBackend(url, anonKey);
}
