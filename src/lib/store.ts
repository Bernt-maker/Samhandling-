import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Backend } from './backend';
import { decryptJson, decryptText, encryptJson, encryptText } from './crypto';
import type {
  Appointment,
  AppointmentData,
  AppointmentRow,
  Comment,
  CommentRow,
  Duty,
  DutyRow,
  Member,
  TableName,
} from '../types';

const aad = {
  appointment: (id: string) => `appointments:${id}`,
  duty: (id: string) => `duties:${id}`,
  comment: (id: string) => `comments:${id}`,
};

async function openAppointment(key: CryptoKey, r: AppointmentRow): Promise<Appointment | null> {
  try {
    const data = await decryptJson<AppointmentData>(key, r, aad.appointment(r.id));
    return {
      id: r.id,
      startsAt: r.starts_at,
      data,
      createdBy: r.created_by ?? '',
      updatedBy: r.updated_by ?? '',
      updatedAt: r.updated_at ?? '',
    };
  } catch {
    return null; // manipulert eller kryptert med annen nøkkel
  }
}

async function openDuty(key: CryptoKey, r: DutyRow): Promise<Duty> {
  let note = '';
  if (r.iv && r.ct) {
    try {
      note = await decryptText(key, { iv: r.iv, ct: r.ct }, aad.duty(r.id));
    } catch {
      note = '';
    }
  }
  return {
    id: r.id,
    startDate: r.start_date,
    endDate: r.end_date,
    memberId: r.member_id,
    note,
    updatedBy: r.updated_by ?? '',
  };
}

async function openComment(key: CryptoKey, r: CommentRow): Promise<Comment | null> {
  try {
    return {
      id: r.id,
      appointmentId: r.appointment_id,
      text: await decryptText(key, r, aad.comment(r.id)),
      author: r.author ?? '',
      createdAt: r.created_at ?? '',
    };
  } catch {
    return null;
  }
}

export type SyncState = 'laster' | 'synkronisert' | 'frakoblet';

export function useFamilyData(backend: Backend, key: CryptoKey) {
  const [members, setMembers] = useState<Member[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [duties, setDuties] = useState<Duty[]>([]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [sync, setSync] = useState<SyncState>('laster');
  const [lastChange, setLastChange] = useState<number>(0);
  const alive = useRef(true);

  const load = useCallback(
    async (table: TableName) => {
      try {
        if (table === 'members') {
          const m = await backend.listMembers();
          if (alive.current) setMembers(m);
        } else if (table === 'appointments') {
          const rows = await backend.listAppointments();
          const list = (await Promise.all(rows.map((r) => openAppointment(key, r)))).filter(
            (a): a is Appointment => a !== null,
          );
          list.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
          if (alive.current) setAppointments(list);
        } else if (table === 'duties') {
          const rows = await backend.listDuties();
          const list = await Promise.all(rows.map((r) => openDuty(key, r)));
          list.sort((a, b) => a.startDate.localeCompare(b.startDate));
          if (alive.current) setDuties(list);
        } else {
          const rows = await backend.listComments();
          const list = (await Promise.all(rows.map((r) => openComment(key, r)))).filter(
            (c): c is Comment => c !== null,
          );
          if (alive.current) setComments(list);
        }
        if (alive.current) setSync('synkronisert');
      } catch {
        if (alive.current) setSync('frakoblet');
      }
    },
    [backend, key],
  );

  const loadAll = useCallback(async () => {
    await Promise.all((['members', 'appointments', 'duties', 'comments'] as TableName[]).map(load));
  }, [load]);

  useEffect(() => {
    alive.current = true;
    void loadAll();
    const unsub = backend.subscribe((table) => {
      setLastChange(Date.now());
      void load(table);
    });
    // Mobiler stopper ofte sanntidsforbindelsen når appen er i bakgrunnen.
    // Hent alt på nytt når appen kommer i forgrunnen eller nettet er tilbake.
    const refresh = () => {
      if (document.visibilityState === 'visible') void loadAll();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('online', refresh);
    window.addEventListener('focus', refresh);
    const offline = () => setSync('frakoblet');
    window.addEventListener('offline', offline);
    const timer = window.setInterval(refresh, 5 * 60 * 1000);
    return () => {
      alive.current = false;
      unsub();
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('online', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('offline', offline);
      window.clearInterval(timer);
    };
  }, [backend, load, loadAll]);

  const actions = useMemo(
    () => ({
      async saveAppointment(id: string | null, startsAt: string, data: AppointmentData) {
        const rowId = id ?? crypto.randomUUID();
        const sealed = await encryptJson(key, data, aad.appointment(rowId));
        await backend.saveAppointment({ id: rowId, starts_at: startsAt, ...sealed });
        await load('appointments');
      },
      async deleteAppointment(id: string) {
        await backend.deleteAppointment(id);
        await Promise.all([load('appointments'), load('comments')]);
      },
      async saveDuties(items: { id?: string; startDate: string; endDate: string; memberId: string; note: string }[]) {
        const rows: DutyRow[] = await Promise.all(
          items.map(async (d) => {
            const id = d.id ?? crypto.randomUUID();
            const sealed = d.note.trim() ? await encryptText(key, d.note.trim(), aad.duty(id)) : null;
            return {
              id,
              start_date: d.startDate,
              end_date: d.endDate,
              member_id: d.memberId,
              iv: sealed?.iv ?? null,
              ct: sealed?.ct ?? null,
            };
          }),
        );
        await backend.saveDuties(rows);
        await load('duties');
      },
      async deleteDuty(id: string) {
        await backend.deleteDuty(id);
        await load('duties');
      },
      async addComment(appointmentId: string, text: string) {
        const id = crypto.randomUUID();
        const sealed = await encryptText(key, text.trim(), aad.comment(id));
        await backend.addComment({ id, appointment_id: appointmentId, ...sealed });
        await load('comments');
      },
      async deleteComment(id: string) {
        await backend.deleteComment(id);
        await load('comments');
      },
      async saveMember(m: Omit<Member, 'id'> & { id?: string }) {
        await backend.saveMember(m);
        await load('members');
      },
      async deleteMember(id: string) {
        await backend.deleteMember(id);
        await Promise.all([load('members'), load('duties')]);
      },
      refresh: loadAll,
    }),
    [backend, key, load, loadAll],
  );

  return { members, appointments, duties, comments, sync, lastChange, actions };
}

export type FamilyData = ReturnType<typeof useFamilyData>;
