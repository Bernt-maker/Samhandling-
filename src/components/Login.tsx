import { useState } from 'react';
import { DEMO_CODE, type Backend } from '../lib/backend';
import { Centered } from './ui';

export function Login({ backend }: { backend: Backend }) {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await backend.sendCode(email.trim().toLowerCase());
      setStep('code');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await backend.verifyCode(email.trim().toLowerCase(), code.trim());
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  return (
    <Centered>
      <h1 className="brand">Mors kalender</h1>
      {backend.demo && <p className="notice">Demomodus – data lagres bare i denne nettleseren.</p>}
      {step === 'email' ? (
        <form onSubmit={send} className="stack">
          <label>
            Din e-postadresse
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="navn@eksempel.no"
            />
          </label>
          <button disabled={busy}>{busy ? 'Sender …' : 'Send meg en innloggingskode'}</button>
          <p className="muted small">
            Du får en engangskode på e-post. Ingen passord å huske for innlogging.
          </p>
        </form>
      ) : (
        <form onSubmit={verify} className="stack">
          <p>
            Vi har sendt en e-post til <b>{email}</b>. Skriv inn koden, eller trykk på lenken i e-posten.
            {backend.demo && <> (I demo: <b>{DEMO_CODE}</b>)</>}
          </p>
          <label>
            Kode fra e-posten
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6,10}"
              required
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
            />
          </label>
          <button disabled={busy}>{busy ? 'Sjekker …' : 'Logg inn'}</button>
          <button type="button" className="ghost" onClick={() => setStep('email')}>
            Bruk en annen e-post
          </button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </Centered>
  );
}
