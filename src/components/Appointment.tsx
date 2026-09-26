import { useState } from 'react';
import type { Appointment as Appt, AppointmentData, AppointmentKind, AppointmentStatus } from '../types';
import { buildIcs, dateKey, dutyOn, fmt, toLocalInput } from '../lib/dates';
import { KIND_ICON, KIND_LABEL, STATUS_LABEL, appointmentTitle, emptyAppointment, nameOf } from '../lib/labels';
import type { ViewProps } from './Main';
import { Dot } from './ui';

export function AppointmentForm({
  data,
  appointment,
  initialDate,
  onDone,
}: ViewProps & { appointment?: Appt; initialDate?: string; onDone: () => void }) {
  const [d, setD] = useState<AppointmentData>(appointment?.data ?? emptyAppointment());
  const [when, setWhen] = useState(
    appointment ? toLocalInput(appointment.startsAt) : `${initialDate ?? dateKey(new Date())}T10:00`,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const set = <K extends keyof AppointmentData>(k: K, v: AppointmentData[K]) => setD((p) => ({ ...p, [k]: v }));

  // Foreslå den som har vakt den dagen som ledsager
  const onDuty = dutyOn(data.duties, when.slice(0, 10));
  const helpers = data.members.filter((m) => m.role !== 'lege');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(when);
    if (Number.isNaN(start.getTime())) return setError('Ugyldig dato/klokkeslett.');
    setBusy(true);
    setError('');
    try {
      await data.actions.saveAppointment(appointment?.id ?? null, start.toISOString(), {
        ...d,
        title: d.title.trim(),
        practitioner: d.practitioner.trim(),
        location: d.location.trim(),
        transport: d.transport.trim(),
        notes: d.notes.trim(),
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
        Type time
        <select value={d.kind} onChange={(e) => set('kind', e.target.value as AppointmentKind)}>
          {(Object.keys(KIND_LABEL) as AppointmentKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_ICON[k]} {KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Beskrivelse (valgfritt)
        <input value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="F.eks. Kontroll høreapparat" />
      </label>
      <div className="grid2">
        <label>
          Dato og tid
          <input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
        </label>
        <label>
          Varighet
          <select value={d.durationMin} onChange={(e) => set('durationMin', Number(e.target.value))}>
            {[15, 30, 45, 60, 90, 120, 180, 240].map((m) => (
              <option key={m} value={m}>
                {m < 60 ? `${m} min` : `${m / 60} t`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Behandler
        <input value={d.practitioner} onChange={(e) => set('practitioner', e.target.value)} placeholder="Navn på lege/tannlege" />
      </label>
      <label>
        Sted
        <input value={d.location} onChange={(e) => set('location', e.target.value)} placeholder="Adresse / avdeling" />
      </label>
      <label>
        Hvem følger mor?
        <select value={d.escortId ?? ''} onChange={(e) => set('escortId', e.target.value || null)}>
          <option value="">Ikke avklart</option>
          {helpers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {onDuty?.memberId === m.id ? ' (har vakt)' : ''}
            </option>
          ))}
        </select>
      </label>
      <label>
        Transport
        <input value={d.transport} onChange={(e) => set('transport', e.target.value)} placeholder="F.eks. taxi bestilt, kjører selv" />
      </label>
      <label>
        Notater (medisiner, spørsmål til legen, forberedelser …)
        <textarea rows={4} value={d.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      {appointment && (
        <label>
          Status
          <select value={d.status} onChange={(e) => set('status', e.target.value as AppointmentStatus)}>
            {(Object.keys(STATUS_LABEL) as AppointmentStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      )}
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>{busy ? 'Lagrer …' : 'Lagre'}</button>
    </form>
  );
}

export function AppointmentDetail({
  data,
  me,
  canEdit,
  appointment: a,
  onEdit,
  onDeleted,
}: ViewProps & { appointment: Appt; onEdit: () => void; onDeleted: () => void }) {
  const { members, comments, actions } = data;
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const start = new Date(a.startsAt);
  const escort = a.data.escortId ? members.find((m) => m.id === a.data.escortId) : undefined;
  const thread = comments
    .filter((c) => c.appointmentId === a.id)
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt));

  const addComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError('');
    try {
      await actions.addComment(a.id, text);
      setText('');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm('Slette denne timen for alle?')) return;
    try {
      await actions.deleteAppointment(a.id);
      onDeleted();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const exportIcs = () => {
    const ics = buildIcs({
      id: a.id,
      start,
      minutes: a.data.durationMin,
      title: `Mor: ${appointmentTitle(a.data)}`,
      location: a.data.location,
      description: [a.data.practitioner && `Behandler: ${a.data.practitioner}`, escort && `Følger: ${escort.name}`]
        .filter(Boolean)
        .join('\n'),
    });
    const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'time.ics';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="stack">
      <div className="detail-head">
        <span className="big-icon">{KIND_ICON[a.data.kind]}</span>
        <div>
          <h3>{appointmentTitle(a.data)}</h3>
          <div className="muted">{KIND_LABEL[a.data.kind]}</div>
        </div>
      </div>
      {a.data.status !== 'planlagt' && <span className={`pill ${a.data.status}`}>{STATUS_LABEL[a.data.status]}</span>}
      <dl className="facts">
        <dt>Når</dt>
        <dd>
          {fmt.weekdayDate(start)} kl. {fmt.time(start)}
        </dd>
        {a.data.practitioner && (
          <>
            <dt>Behandler</dt>
            <dd>{a.data.practitioner}</dd>
          </>
        )}
        {a.data.location && (
          <>
            <dt>Sted</dt>
            <dd>
              {a.data.location}{' '}
              <a href={`https://maps.apple.com/?q=${encodeURIComponent(a.data.location)}`} target="_blank" rel="noreferrer">
                kart
              </a>
            </dd>
          </>
        )}
        <dt>Følger mor</dt>
        <dd>
          {escort ? (
            <>
              <Dot color={escort.color} /> {escort.name}
            </>
          ) : (
            <span className="warn">Ikke avklart</span>
          )}
        </dd>
        {a.data.transport && (
          <>
            <dt>Transport</dt>
            <dd>{a.data.transport}</dd>
          </>
        )}
      </dl>
      {a.data.notes && <p className="notes">{a.data.notes}</p>}
      <p className="muted small">
        Sist endret av {nameOf(members, a.updatedBy)}
        {a.updatedAt && ` · ${fmt.dateTime(new Date(a.updatedAt))}`}
      </p>

      <div className="row wrap">
        {canEdit && <button onClick={onEdit}>Endre</button>}
        <button className="ghost" onClick={exportIcs}>Legg i min kalender</button>
        {canEdit && (
          <button className="danger ghost" onClick={remove}>
            Slett
          </button>
        )}
      </div>

      <section>
        <h3>Kommentarer og oppfølging</h3>
        {thread.length === 0 && <p className="muted small">Ingen kommentarer ennå.</p>}
        <ul className="comments">
          {thread.map((c) => {
            const author = members.find((m) => m.email === c.author);
            return (
              <li key={c.id}>
                <div className="comment-head">
                  <Dot color={author?.color ?? '#999'} />
                  <b>{author?.name ?? c.author}</b>
                  {author?.role === 'lege' && <span className="badge">lege</span>}
                  <span className="muted small">{c.createdAt && fmt.dateTime(new Date(c.createdAt))}</span>
                  {(c.author === me.email || me.role === 'admin') && (
                    <button
                      className="icon small"
                      aria-label="Slett kommentar"
                      onClick={() => confirm('Slette kommentaren?') && void actions.deleteComment(c.id)}
                    >
                      🗑
                    </button>
                  )}
                </div>
                <p>{c.text}</p>
              </li>
            );
          })}
        </ul>
        <form onSubmit={addComment} className="stack">
          <textarea
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Skriv hva legen sa, nye medisiner, oppfølging …"
          />
          <button disabled={busy || !text.trim()}>Legg til kommentar</button>
        </form>
      </section>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
