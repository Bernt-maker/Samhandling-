import { useEffect, useState } from 'react';
import type { Backend } from '../lib/backend';
import { fmt } from '../lib/dates';
import { COLORS, ROLE_LABEL, nameOf } from '../lib/labels';
import type { AuditRow, Member, Role } from '../types';
import type { ViewProps } from './Main';
import { Dot, Modal } from './ui';

const TABLE_LABEL: Record<string, string> = {
  appointments: 'time',
  duties: 'vakt',
  comments: 'kommentar',
  members: 'medlem',
};
const ACTION_LABEL: Record<string, string> = { insert: 'la til', update: 'endret', delete: 'slettet' };

export function Family({
  data,
  me,
  backend,
  onLock,
  onSignOut,
}: ViewProps & { backend: Backend; onLock: () => void; onSignOut: () => void }) {
  const [editing, setEditing] = useState<Member | 'new' | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const isAdmin = me.role === 'admin';

  // Hentes når loggen åpnes, og på nytt når noe endres mens den er åpen
  useEffect(() => {
    if (!showAudit) return;
    void backend.listAudit(100).then(setAudit).catch(() => setAudit([]));
  }, [backend, showAudit, data.lastChange]);

  return (
    <div className="stack gap">
      <section>
        <div className="row between">
          <h2>Familien</h2>
          {isAdmin && <button className="small" onClick={() => setEditing('new')}>+ Legg til</button>}
        </div>
        <ul className="list">
          {data.members.map((m) => (
            <li key={m.id}>
              <button className="member" disabled={!isAdmin} onClick={() => setEditing(m)}>
                <Dot color={m.color} />
                <span className="member-main">
                  <b>{m.name}</b> {m.id === me.id && <span className="badge">deg</span>}
                  <span className="muted small">
                    {ROLE_LABEL[m.role]} · {m.email}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
        {!isAdmin && <p className="muted small">Bare administrator kan legge til eller endre medlemmer.</p>}
      </section>

      <section>
        <h2>Endringslogg</h2>
        {!showAudit ? (
          <button className="ghost small" onClick={() => setShowAudit(true)}>Vis hvem som har endret hva</button>
        ) : (
          <ul className="audit small">
            {audit.length === 0 && <li className="muted">Ingen endringer ennå.</li>}
            {audit.map((r) => (
              <li key={r.id}>
                <span className="muted">{fmt.dateTime(new Date(r.at))}</span> {nameOf(data.members, r.actor)}{' '}
                {ACTION_LABEL[r.action] ?? r.action} {TABLE_LABEL[r.table_name] ?? r.table_name}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card">
        <h2>Sikkerhet</h2>
        <ul className="small security">
          <li>Innlogging med engangskode til din e-post.</li>
          <li>Innholdet krypteres på telefonen med familiepassordet før det lagres (AES-256).</li>
          <li>Bare personene over har tilgang – det håndheves også i databasen.</li>
          <li>Alle endringer logges med navn og tidspunkt.</li>
        </ul>
        <div className="row wrap">
          <button className="ghost" onClick={onLock}>Lås (krev familiepassord)</button>
          <button className="ghost" onClick={onSignOut}>Logg ut</button>
        </div>
      </section>

      <section className="card">
        <h2>Installer på telefonen</h2>
        <p className="small">
          <b>iPhone:</b> Åpne i Safari → Del-knappen → «Legg til på Hjem-skjerm».
          <br />
          <b>Android:</b> Åpne i Chrome → ⋮-menyen → «Installer app».
        </p>
      </section>

      {editing && (
        <Modal title={editing === 'new' ? 'Nytt medlem' : 'Endre medlem'} onClose={() => setEditing(null)}>
          <MemberForm data={data} me={me} member={editing === 'new' ? undefined : editing} onDone={() => setEditing(null)} />
        </Modal>
      )}
    </div>
  );
}

function MemberForm({
  data,
  me,
  member,
  onDone,
}: {
  data: ViewProps['data'];
  me: Member;
  member?: Member;
  onDone: () => void;
}) {
  const [f, setF] = useState({
    name: member?.name ?? '',
    email: member?.email ?? '',
    role: member?.role ?? ('familie' as Role),
    color: member?.color ?? COLORS[data.members.length % COLORS.length],
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await data.actions.saveMember({ id: member?.id, ...f, name: f.name.trim() });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!member || !confirm(`Fjerne ${member.name}? Personen mister tilgang umiddelbart, og vaktene deres slettes.`)) return;
    try {
      await data.actions.deleteMember(member.id);
      onDone();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  return (
    <form onSubmit={submit} className="stack">
      <label>
        Navn
        <input required maxLength={60} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      </label>
      <label>
        E-post (den de logger inn med)
        <input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </label>
      <label>
        Rolle
        <select
          value={f.role}
          disabled={member?.id === me.id}
          onChange={(e) => setF({ ...f, role: e.target.value as Role })}
        >
          {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
          ))}
        </select>
      </label>
      <div>
        <div className="small">Farge</div>
        <div className="colors">
          {COLORS.map((c) => (
            <button
              type="button"
              key={c}
              aria-label={`Farge ${c}`}
              className={f.color === c ? 'swatch sel' : 'swatch'}
              style={{ background: c }}
              onClick={() => setF({ ...f, color: c })}
            />
          ))}
        </div>
      </div>
      {!member && (
        <p className="notice small">
          Etterpå: send lenken til appen og gi personen familiepassordet muntlig.
        </p>
      )}
      {error && <p className="error">{error}</p>}
      <button disabled={busy}>Lagre</button>
      {member && member.id !== me.id && (
        <button type="button" className="danger ghost" onClick={remove}>Fjern fra familien</button>
      )}
    </form>
  );
}
