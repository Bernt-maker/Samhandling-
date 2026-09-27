import { useEffect, useMemo, useState } from 'react';
import { createBackend, type Backend } from './lib/backend';
import { clearKeys, loadKey } from './lib/keystore';
import type { Member, VaultRow } from './types';
import { Login } from './components/Login';
import { CreateVault, Unlock } from './components/Vault';
import { Main } from './components/Main';
import { Centered } from './components/ui';

const demoMode = new URLSearchParams(location.search).has('demo');

type Phase =
  | { k: 'loading' }
  | { k: 'signedOut' }
  | { k: 'noAccess'; email: string }
  | { k: 'error'; message: string }
  | { k: 'needVault'; me: Member }
  | { k: 'locked'; me: Member; vault: VaultRow }
  | { k: 'ready'; me: Member; key: CryptoKey };

export function App() {
  const result = useMemo(() => {
    try {
      return { backend: createBackend(demoMode), error: '' };
    } catch (e) {
      return { backend: null, error: (e as Error).message };
    }
  }, []);
  if (result.error)
    return (
      <Centered>
        <h2>Feil i oppsettet</h2>
        <p>{result.error}</p>
        <p className="muted small">
          Rett variablene i GitHub (Settings → Secrets and variables → Actions → Variables) og publiser på nytt.
        </p>
      </Centered>
    );
  if (!result.backend) return <NotConfigured />;
  return <Gate backend={result.backend} />;
}

function Gate({ backend }: { backend: Backend }) {
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const [email, setEmail] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    void backend.currentEmail().then(setEmail);
    return backend.onAuthChange(setEmail);
  }, [backend]);

  useEffect(() => {
    if (email === undefined) return;
    if (email === null) {
      setPhase({ k: 'signedOut' });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const members = await backend.listMembers();
        const me = members.find((m) => m.email === email);
        if (!me) return !cancelled && setPhase({ k: 'noAccess', email });
        const vault = await backend.getVault();
        if (!vault) return !cancelled && setPhase({ k: 'needVault', me });
        const saved = await loadKey(`${email}:${vault.salt}`);
        if (cancelled) return;
        setPhase(saved ? { k: 'ready', me, key: saved } : { k: 'locked', me, vault });
      } catch (e) {
        if (!cancelled) setPhase({ k: 'error', message: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [backend, email]);

  const signOut = async () => {
    await clearKeys();
    await backend.signOut();
  };

  switch (phase.k) {
    case 'loading':
      return <Centered>Laster …</Centered>;
    case 'signedOut':
      return <Login backend={backend} />;
    case 'error':
      return (
        <Centered>
          <h2>Kunne ikke koble til</h2>
          <p className="muted">{phase.message}</p>
          <button onClick={() => location.reload()}>Prøv igjen</button>
        </Centered>
      );
    case 'noAccess':
      return (
        <Centered>
          <h2>Ingen tilgang ennå</h2>
          <p>
            Du er logget inn som <b>{phase.email}</b>, men denne adressen er ikke lagt til i familien.
            Be administrator legge deg til under «Familie», og prøv igjen.
          </p>
          <div className="row">
            <button onClick={() => location.reload()}>Prøv igjen</button>
            <button className="ghost" onClick={signOut}>Logg ut</button>
          </div>
        </Centered>
      );
    case 'needVault':
      return phase.me.role === 'admin' ? (
        <CreateVault backend={backend} me={phase.me} onDone={(key) => setPhase({ k: 'ready', me: phase.me, key })} />
      ) : (
        <Centered>
          <h2>Venter på oppsett</h2>
          <p>Administrator har ikke laget familiepassordet ennå. Prøv igjen litt senere.</p>
          <div className="row">
            <button onClick={() => location.reload()}>Prøv igjen</button>
            <button className="ghost" onClick={signOut}>Logg ut</button>
          </div>
        </Centered>
      );
    case 'locked':
      return (
        <Unlock
          vault={phase.vault}
          me={phase.me}
          onUnlock={(key) => setPhase({ k: 'ready', me: phase.me, key })}
          onSignOut={signOut}
        />
      );
    case 'ready':
      return (
        <Main
          backend={backend}
          me={phase.me}
          cryptoKey={phase.key}
          onLock={async () => {
            await clearKeys();
            location.reload();
          }}
          onSignOut={signOut}
        />
      );
  }
}

function NotConfigured() {
  return (
    <Centered>
      <h1 className="brand">Mors kalender</h1>
      <p>
        Appen er ikke koblet til en database ennå. Se <b>README.md</b> for oppsett av Supabase
        (tar ca. 15 minutter).
      </p>
      <p className="muted">Du kan prøve appen med testdata som bare lagres i denne nettleseren:</p>
      <a className="button" href="?demo">Prøv demo</a>
    </Centered>
  );
}
