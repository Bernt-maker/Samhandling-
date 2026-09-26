import { useState } from 'react';
import { addDays, buildRotation, dateKey, isoWeek, mondayOf, range } from '../lib/dates';
import { nameOf } from '../lib/labels';
import type { Duty } from '../types';
import type { ViewProps } from './Main';
import { Dot, Modal } from './ui';

export function Duties({ data, me, canEdit }: ViewProps) {
  const today = dateKey(new Date());
  const [editing, setEditing] = useState<Duty | 'new' | null>(null);
  const [rotation, setRotation] = useState(false);
  const [showPast, setShowPast] = useState(false);
  const { members, duties } = data;

  const upcoming = duties.filter((d) => d.endDate >= today);
  const past = duties.filter((d) => d.endDate < today).reverse();

  const counts = new Map<string, number>();
  for (const d of upcoming) counts.set(d.memberId, (counts.get(d.memberId) ?? 0) + 1);

  const row = (d: Duty) => {
    const m = members.find((x) => x.id === d.memberId);
    const active = d.startDate <= today && today <= d.endDate;
    return (
      <li key={d.id}>
        <button className={`duty ${active ? 'active' : ''}`} onClick={() => canEdit && setEditing(d)} disabled={!canEdit}>
          <span className="duty-color" style={{ background: m?.color ?? '#999' }} />
          <span className="duty-main">
            <span>
              <b>{m?.name ?? 'Ukjent'}</b>
              {d.memberId === me.id && <span className="badge">deg</span>}
              {active && <span className="badge now">nå</span>}
            </span>
            <span className="muted small">
              {range(d.startDate, d.endDate)} · uke {isoWeek(d.startDate)}
            </span>
            {d.note && <span className="small">{d.note}</span>}
          </span>
        </button>
      </li>
    );
  };

  return (
    <div className="stack gap">
      <div className="row between">
        <h2>Vaktordning</h2>
        {canEdit && (
          <div className="row">
            <button className="small ghost" onClick={() => setRotation(true)}>Lag turnus</button>
            <button className="small" onClick={() => setEditing('new')}>+ Vakt</button>
          </div>
        )}
      </div>
      <p className="muted small">
        Den som har vakt er hovedansvarlig for mor i perioden: følge opp timer, svare på telefon og ta kontakt ved behov.
        {canEdit && ' Trykk på en vakt for å bytte eller endre.'}
      </p>

      {counts.size > 0 && (
        <div className="legend small">
          {members
            .filter((m) => m.role !== 'lege')
            .map((m) => (
              <span key={m.id}>
                <Dot color={m.color} /> {m.name}: {counts.get(m.id) ?? 0}
              </span>
            ))}
        </div>
      )}

      {upcoming.length === 0 ? (
        <p className="muted">Ingen kommende vakter. {canEdit && 'Bruk «Lag turnus» for å fordele ukene.'}</p>
      ) : (
        <ul className="list">{upcoming.map(row)}</ul>
      )}

      {past.length > 0 && (
        <section>
          <button className="ghost small" onClick={() => setShowPast((v) => !v)}>
            {showPast ? 'Skjul' : 'Vis'} tidligere vakter ({past.length})
          </button>
          {showPast && <ul className="list past">{past.slice(0, 50).map(row)}</ul>}
        </section>
      )}

      {editing && (
        <Modal title={editing === 'new' ? 'Ny vakt' : 'Endre vakt'} onClose={() => setEditing(null)}>
          <DutyForm data={data} duty={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
      {rotation && (
        <Modal title="Lag turnus" onClose={() => setRotation(false)}>
          <RotationForm data={data} onDone={() => setRotation(false)} />
        </Modal>
      )}
    </div>
  );
}

function DutyForm({ data, duty, onDone }: { data: ViewProps['data']; duty?: Duty; onDone: () => void }) {
  const helpers = data.members.filter((m) => m.role !== 'lege');
  const start = duty?.startDate ?? mondayOf(dateKey(new Date()));
  const [f, setF] = useState({
    startDate: start,
    endDate: duty?.endDate ?? addDays(start, 6),
    memberId: duty?.memberId ?? helpers[0]?.id ?? '',
    note: duty?.note ?? '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (f.endDate < f.startDate) return setError('Sluttdato kan ikke være før startdato.');
    if (!f.memberId) return setError('Velg hvem som har vakt.');
    setBusy(true);
    try {
      await data.actions.saveDuties([{ id: duty?.id, ...f }]);
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!duty || !confirm('Slette denne vakten?')) return;
    try {
      await data.actions.deleteDuty(duty.id);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Hvem har vakt
        <select value={f.memberId} onChange={(e) => setF({ ...f, memberId: e.target.value })}>
          {helpers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <div className="grid2">
        <label>
          Fra
          <input type="date" required value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} />
        </label>
        <label>
          Til og med
          <input type="date" required value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        </label>
      </div>
      <label>
        Merknad (valgfritt)
        <input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="F.eks. byttet med …" />
      </label>
      {duty?.updatedBy && <p className="muted small">Sist endret av {nameOf(data.members, duty.updatedBy)}</p>}
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>Lagre</button>
      {duty && (
        <button type="button" className="danger ghost" onClick={remove}>Slett vakt</button>
      )}
    </form>
  );
}

function RotationForm({ data, onDone }: { data: ViewProps['data']; onDone: () => void }) {
  const helpers = data.members.filter((m) => m.role !== 'lege');
  const lastEnd = data.duties.at(-1)?.endDate;
  const [startDate, setStartDate] = useState(
    lastEnd && lastEnd >= dateKey(new Date()) ? addDays(lastEnd, 1) : mondayOf(dateKey(new Date())),
  );
  const [periodDays, setPeriodDays] = useState(7);
  const [periods, setPeriods] = useState(helpers.length * 3);
  const [order, setOrder] = useState(helpers.map((m) => m.id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const orderedMembers = order
    .map((id) => helpers.find((m) => m.id === id))
    .filter((m): m is NonNullable<typeof m> => Boolean(m));
  const preview = buildRotation({ startDate, periodDays, periods, order: orderedMembers });

  const moveUp = (i: number) => {
    if (i === 0) return;
    const next = [...order];
    [next[i - 1], next[i]] = [next[i], next[i - 1]];
    setOrder(next);
  };

  const overlaps = data.duties.filter((d) => preview.some((p) => p.startDate <= d.endDate && d.startDate <= p.endDate));

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      await data.actions.saveDuties(preview.map((p) => ({ ...p, note: '' })));
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="grid2">
        <label>
          Start
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label>
          Lengde per vakt
          <select value={periodDays} onChange={(e) => setPeriodDays(Number(e.target.value))}>
            <option value={7}>1 uke</option>
            <option value={14}>2 uker</option>
            <option value={3}>3 dager</option>
            <option value={1}>1 dag</option>
          </select>
        </label>
      </div>
      <label>
        Antall vakter
        <input type="number" min={1} max={104} value={periods} onChange={(e) => setPeriods(Number(e.target.value))} />
      </label>
      <div>
        <div className="small muted">Rekkefølge (trykk ↑ for å flytte opp)</div>
        <ol className="order">
          {orderedMembers.map((m, i) => (
            <li key={m.id}>
              <Dot color={m.color} /> {m.name}
              {i > 0 && (
                <button type="button" className="icon small" aria-label={`Flytt ${m.name} opp`} onClick={() => moveUp(i)}>↑</button>
              )}
            </li>
          ))}
        </ol>
      </div>
      <div className="small">
        <b>Forhåndsvisning:</b>
        <ul className="preview">
          {preview.slice(0, 8).map((p) => (
            <li key={p.startDate}>
              {range(p.startDate, p.endDate)}: {helpers.find((m) => m.id === p.memberId)?.name}
            </li>
          ))}
          {preview.length > 8 && <li>… og {preview.length - 8} til</li>}
        </ul>
      </div>
      {overlaps.length > 0 && (
        <p className="notice">
          {overlaps.length} eksisterende vakt(er) overlapper med denne perioden. De blir liggende – slett dem først hvis
          turnusen skal erstatte dem.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <button disabled={busy || preview.length === 0} onClick={submit}>
        Opprett {preview.length} vakter
      </button>
    </div>
  );
}
