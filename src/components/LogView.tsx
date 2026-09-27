import { useState } from 'react';
import { dateKey, fmt, parseDateKey, range, toLocalInput } from '../lib/dates';
import { EVENT_ICON, EVENT_LABEL, emptyEvent, eventTitle, nameOf } from '../lib/labels';
import type { EventKind, LogEvent, LogEventData, Member } from '../types';
import type { ViewProps } from './Main';
import { Modal } from './ui';

type Filter = 'alle' | 'viktige' | EventKind;
type Dialog = null | { k: 'new' } | { k: 'view'; id: string } | { k: 'edit'; id: string };

export function LogView({ data, me }: ViewProps) {
  const { events, members, eventsMissing } = data;
  const [filter, setFilter] = useState<Filter>('alle');
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<Dialog>(null);

  if (eventsMissing) {
    return (
      <div className="card stack">
        <h2>Loggen er ikke satt opp ennå</h2>
        <p className="small">
          Administrator må kjøre fila <b>supabase/migrations/002_logg.sql</b> i Supabase → SQL Editor én gang.
          Deretter dukker loggen opp her av seg selv.
        </p>
      </div>
    );
  }

  const q = query.trim().toLowerCase();
  const shown = events.filter((e) => {
    if (filter === 'viktige' && !e.data.important) return false;
    if (filter !== 'alle' && filter !== 'viktige' && e.data.kind !== filter) return false;
    if (q && !`${e.data.title} ${e.data.text} ${EVENT_LABEL[e.data.kind]}`.toLowerCase().includes(q)) return false;
    return true;
  });

  // Gruppér per måned, nyeste først
  const groups: { month: string; items: LogEvent[] }[] = [];
  for (const e of shown) {
    const d = new Date(e.occurredAt);
    const month = fmt.monthYear(d.getFullYear(), d.getMonth());
    const last = groups.at(-1);
    if (last?.month === month) last.items.push(e);
    else groups.push({ month, items: [e] });
  }

  const kindsInUse = (Object.keys(EVENT_LABEL) as EventKind[]).filter((k) => events.some((e) => e.data.kind === k));
  const ongoing = events.filter((e) => e.data.kind === 'innleggelse' && !e.data.endDate);
  const current = dialog && dialog.k !== 'new' ? events.find((e) => e.id === dialog.id) : undefined;

  return (
    <div className="stack gap">
      <div className="row between">
        <h2>Logg</h2>
        <button className="small" onClick={() => setDialog({ k: 'new' })}>+ Skriv i loggen</button>
      </div>
      <p className="muted small">
        Alt som skjer med mor: innleggelser, legevakt, telefonsamtaler, besøk, beskjeder fra hjemmetjenesten,
        medisinendringer. Alle i familien kan skrive her.
      </p>

      {ongoing.map((e) => (
        <button key={e.id} className="notice ongoing" onClick={() => setDialog({ k: 'view', id: e.id })}>
          🏥 <b>Innlagt nå</b> siden {fmt.shortDate(new Date(e.occurredAt))}
          {e.data.title && ` – ${e.data.title}`}
        </button>
      ))}

      <input
        type="search"
        placeholder="Søk i loggen …"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        aria-label="Søk i loggen"
      />
      <div className="chips">
        <Chip active={filter === 'alle'} onClick={() => setFilter('alle')}>Alle</Chip>
        <Chip active={filter === 'viktige'} onClick={() => setFilter('viktige')}>❗ Viktige</Chip>
        {kindsInUse.map((k) => (
          <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>
            {EVENT_ICON[k]} {EVENT_LABEL[k]}
          </Chip>
        ))}
      </div>

      {events.length === 0 ? (
        <p className="muted">
          Ingen hendelser ennå. Trykk «+ Skriv i loggen» for å notere en telefonsamtale, et besøk eller en innleggelse.
        </p>
      ) : shown.length === 0 ? (
        <p className="muted">Ingen treff.</p>
      ) : (
        groups.map((g) => (
          <section key={g.month}>
            <h3 className="month-label">{g.month}</h3>
            <ul className="list">
              {g.items.map((e) => (
                <EventItem key={e.id} e={e} members={members} onOpen={() => setDialog({ k: 'view', id: e.id })} />
              ))}
            </ul>
          </section>
        ))
      )}

      {dialog?.k === 'new' && (
        <Modal title="Skriv i loggen" onClose={() => setDialog(null)}>
          <EventForm data={data} onDone={() => setDialog(null)} />
        </Modal>
      )}
      {dialog?.k === 'edit' && current && (
        <Modal title="Endre hendelse" onClose={() => setDialog({ k: 'view', id: current.id })}>
          <EventForm data={data} event={current} onDone={() => setDialog({ k: 'view', id: current.id })} />
        </Modal>
      )}
      {dialog?.k === 'view' && current && (
        <Modal title="Hendelse" onClose={() => setDialog(null)}>
          <EventDetail
            data={data}
            me={me}
            event={current}
            onEdit={() => setDialog({ k: 'edit', id: current.id })}
            onDeleted={() => setDialog(null)}
          />
        </Modal>
      )}
    </div>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" className={`chip ${active ? 'active' : ''}`} aria-pressed={active} onClick={onClick}>
      {children}
    </button>
  );
}

function periodText(e: LogEvent): string | null {
  if (e.data.kind !== 'innleggelse') return null;
  const start = dateKey(new Date(e.occurredAt));
  return e.data.endDate ? `Innlagt ${range(start, e.data.endDate)}` : 'Innlagt – pågår';
}

export function EventItem({ e, members, onOpen }: { e: LogEvent; members: Member[]; onOpen: () => void }) {
  const d = new Date(e.occurredAt);
  const period = periodText(e);
  return (
    <li>
      <button className={`event ${e.data.important ? 'important' : ''}`} onClick={onOpen}>
        <span className="appt-icon" aria-hidden>{EVENT_ICON[e.data.kind]}</span>
        <span className="appt-main">
          <span className="appt-title">
            {e.data.important && <span className="flag">❗</span>}
            {eventTitle(e.data)}
          </span>
          <span className="muted small">
            {fmt.shortDate(d)} kl. {fmt.time(d)} · {nameOf(members, e.createdBy)}
            {period && ` · ${period}`}
          </span>
          {e.data.text && <span className="snippet small">{e.data.text}</span>}
        </span>
      </button>
    </li>
  );
}

function EventForm({ data, event, onDone }: { data: ViewProps['data']; event?: LogEvent; onDone: () => void }) {
  const [d, setD] = useState<LogEventData>(event?.data ?? emptyEvent());
  const [when, setWhen] = useState(toLocalInput(event?.occurredAt ?? new Date().toISOString()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof LogEventData>(k: K, v: LogEventData[K]) => setD((p) => ({ ...p, [k]: v }));

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    const start = new Date(when);
    if (Number.isNaN(start.getTime())) return setError('Ugyldig dato/klokkeslett.');
    if (d.endDate && d.endDate < dateKey(start)) return setError('Utskrivning kan ikke være før innleggelse.');
    if (!d.title.trim() && !d.text.trim()) return setError('Skriv en kort beskrivelse av hva som skjedde.');
    setBusy(true);
    setError('');
    try {
      await data.actions.saveEvent(event?.id ?? null, start.toISOString(), {
        ...d,
        title: d.title.trim(),
        text: d.text.trim(),
        endDate: d.kind === 'innleggelse' ? d.endDate : '',
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Hva slags hendelse
        <select value={d.kind} onChange={(e) => set('kind', e.target.value as EventKind)}>
          {(Object.keys(EVENT_LABEL) as EventKind[]).map((k) => (
            <option key={k} value={k}>
              {EVENT_ICON[k]} {EVENT_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        {d.kind === 'innleggelse' ? 'Innlagt' : 'Når'}
        <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
      </label>
      {d.kind === 'innleggelse' && (
        <label>
          Utskrevet (la stå tom hvis hun fortsatt er innlagt)
          <input type="date" value={d.endDate} onChange={(e) => set('endDate', e.target.value)} />
        </label>
      )}
      <label>
        Kort oppsummering
        <input
          value={d.title}
          maxLength={120}
          onChange={(e) => set('title', e.target.value)}
          placeholder={
            d.kind === 'telefon'
              ? 'F.eks. Snakket med fastlegen om blodtrykket'
              : d.kind === 'innleggelse'
                ? 'F.eks. Haukeland, medisinsk avdeling – lungebetennelse'
                : 'Hva skjedde?'
          }
        />
      </label>
      <label>
        Detaljer
        <textarea
          rows={6}
          value={d.text}
          onChange={(e) => set('text', e.target.value)}
          placeholder="Hvem, hva ble sagt, hva må følges opp …"
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={d.important} onChange={(e) => set('important', e.target.checked)} />
        Viktig – marker for hele familien
      </label>
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Lagrer …' : 'Lagre i loggen'}</button>
    </form>
  );
}

function EventDetail({
  data,
  me,
  event: e,
  onEdit,
  onDeleted,
}: {
  data: ViewProps['data'];
  me: Member;
  event: LogEvent;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState('');
  const d = new Date(e.occurredAt);
  const mine = e.createdBy === me.email || me.role === 'admin';
  const period = periodText(e);

  const remove = async () => {
    if (!confirm('Slette denne hendelsen for alle?')) return;
    try {
      await data.actions.deleteEvent(e.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <div className="stack">
      <div className="detail-head">
        <span className="big-icon">{EVENT_ICON[e.data.kind]}</span>
        <div>
          <h3>{eventTitle(e.data)}</h3>
          <div className="muted">{EVENT_LABEL[e.data.kind]}</div>
        </div>
      </div>
      {e.data.important && <span className="pill important">❗ Viktig</span>}
      <dl className="facts">
        <dt>Når</dt>
        <dd>
          {fmt.weekdayDate(d)} kl. {fmt.time(d)}
        </dd>
        {period && (
          <>
            <dt>Periode</dt>
            <dd>{e.data.endDate ? `${period} (utskrevet ${fmt.shortDate(parseDateKey(e.data.endDate))})` : period}</dd>
          </>
        )}
        <dt>Skrevet av</dt>
        <dd>{nameOf(data.members, e.createdBy)}</dd>
      </dl>
      {e.data.text && <p className="notes">{e.data.text}</p>}
      {e.updatedBy && e.updatedBy !== e.createdBy && (
        <p className="muted small">
          Sist endret av {nameOf(data.members, e.updatedBy)}
          {e.updatedAt && ` · ${fmt.dateTime(new Date(e.updatedAt))}`}
        </p>
      )}
      {mine && (
        <div className="row wrap">
          <button onClick={onEdit}>Endre</button>
          <button className="danger ghost" onClick={remove}>Slett</button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
