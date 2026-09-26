import { useState } from 'react';
import type { Backend } from '../lib/backend';
import { createVault, openVault, passphraseProblem } from '../lib/crypto';
import { saveKey } from '../lib/keystore';
import type { Member, VaultRow } from '../types';
import { Centered } from './ui';

export function CreateVault({ backend, me, onDone }: { backend: Backend; me: Member; onDone: (k: CryptoKey) => void }) {
  const [pass, setPass] = useState('');
  const [pass2, setPass2] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const problem = passphraseProblem(pass);
    if (problem) return setError(problem);
    if (pass !== pass2) return setError('Passordene er ikke like.');
    setBusy(true);
    setError('');
    try {
      const { row, key } = await createVault(pass);
      await backend.createVault(row);
      if (remember) await saveKey(`${me.email}:${row.salt}`, key);
      onDone(key);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Centered>
      <h2>Lag familiepassord</h2>
      <p>
        Alt som skrives i kalenderen krypteres med dette passordet <b>før</b> det forlater telefonen.
        Ingen andre – heller ikke de som drifter serveren – kan lese innholdet.
      </p>
      <p className="notice">
        Del passordet med søstrene og niesen <b>muntlig eller på papir</b>, ikke på SMS/e-post.
        Hvis alle glemmer det, kan innholdet ikke gjenopprettes.
      </p>
      <form onSubmit={submit} className="stack">
        <label>
          Familiepassord (minst 12 tegn – gjerne en setning)
          <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <label>
          Gjenta passordet
          <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Husk på denne enheten
        </label>
        <button disabled={busy}>{busy ? 'Lager nøkkel …' : 'Lagre familiepassord'}</button>
      </form>
      {error && <p className="error">{error}</p>}
    </Centered>
  );
}

export function Unlock({
  vault,
  me,
  onUnlock,
  onSignOut,
}: {
  vault: VaultRow;
  me: Member;
  onUnlock: (k: CryptoKey) => void;
  onSignOut: () => void;
}) {
  const [pass, setPass] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const key = await openVault(pass, vault);
    if (!key) {
      setBusy(false);
      setError('Feil familiepassord.');
      return;
    }
    if (remember) await saveKey(`${me.email}:${vault.salt}`, key);
    onUnlock(key);
  };

  return (
    <Centered>
      <h2>Hei, {me.name}</h2>
      <p>Skriv inn familiepassordet for å åpne kalenderen.</p>
      <form onSubmit={submit} className="stack">
        <label>
          Familiepassord
          <input type="password" autoComplete="current-password" autoFocus value={pass} onChange={(e) => setPass(e.target.value)} />
        </label>
        <label className="check">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
          Husk på denne enheten
        </label>
        <button disabled={busy}>{busy ? 'Åpner …' : 'Åpne'}</button>
        <button type="button" className="ghost" onClick={onSignOut}>Logg ut</button>
      </form>
      {error && <p className="error">{error}</p>}
    </Centered>
  );
}
