import { useState } from 'react';
import type { Backend } from '../lib/backend';
import { useFamilyData } from '../lib/store';
import type { Member } from '../types';
import { Overview } from './Overview';
import { CalendarView } from './CalendarView';
import { Duties } from './Duties';
import { Family } from './Family';
import { LogView } from './LogView';
import { AppointmentDetail, AppointmentForm } from './Appointment';
import { Modal } from './ui';

type Tab = 'oversikt' | 'kalender' | 'logg' | 'vakter' | 'familie';
type Dialog = null | { k: 'new'; date?: string } | { k: 'view'; id: string } | { k: 'edit'; id: string };

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'oversikt', label: 'Oversikt', icon: '🏠' },
  { id: 'kalender', label: 'Kalender', icon: '📅' },
  { id: 'logg', label: 'Logg', icon: '📓' },
  { id: 'vakter', label: 'Vakter', icon: '🤝' },
  { id: 'familie', label: 'Familie', icon: '👪' },
];

export interface ViewProps {
  data: ReturnType<typeof useFamilyData>;
  me: Member;
  canEdit: boolean;
  openAppointment: (id: string) => void;
  newAppointment: (date?: string) => void;
  openLog: () => void;
}

export function Main({
  backend,
  me: initialMe,
  cryptoKey,
  onLock,
  onSignOut,
}: {
  backend: Backend;
  me: Member;
  cryptoKey: CryptoKey;
  onLock: () => void;
  onSignOut: () => void;
}) {
  const data = useFamilyData(backend, cryptoKey);
  const [tab, setTab] = useState<Tab>('oversikt');
  const [dialog, setDialog] = useState<Dialog>(null);

  // Rollen kan endres av admin mens appen er åpen
  const me = data.members.find((m) => m.id === initialMe.id) ?? initialMe;
  const canEdit = me.role === 'admin' || me.role === 'familie';

  const props: ViewProps = {
    data,
    me,
    canEdit,
    openAppointment: (id) => setDialog({ k: 'view', id }),
    newAppointment: (date) => setDialog({ k: 'new', date }),
    openLog: () => setTab('logg'),
  };

  const current = dialog && dialog.k !== 'new' ? data.appointments.find((a) => a.id === dialog.id) : undefined;

  return (
    <div className="app">
      <header className="topbar">
        <span className="brand">Mors kalender</span>
        <span className={`sync ${data.sync}`} title="Synkronisering">
          {data.sync === 'synkronisert' ? '● Oppdatert' : data.sync === 'laster' ? '○ Laster' : '● Frakoblet'}
        </span>
        {backend.demo && <span className="badge">DEMO</span>}
      </header>

      <main className="content">
        {tab === 'oversikt' && <Overview {...props} />}
        {tab === 'kalender' && <CalendarView {...props} />}
        {tab === 'logg' && <LogView {...props} />}
        {tab === 'vakter' && <Duties {...props} />}
        {tab === 'familie' && <Family {...props} backend={backend} onLock={onLock} onSignOut={onSignOut} />}
      </main>

      {canEdit && (tab === 'oversikt' || tab === 'kalender') && (
        <button className="fab" aria-label="Ny time" onClick={() => setDialog({ k: 'new' })}>
          ＋
        </button>
      )}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            <span aria-hidden>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </nav>

      {dialog?.k === 'new' && (
        <Modal title="Ny time" onClose={() => setDialog(null)}>
          <AppointmentForm {...props} initialDate={dialog.date} onDone={() => setDialog(null)} />
        </Modal>
      )}
      {dialog?.k === 'edit' && current && (
        <Modal title="Endre time" onClose={() => setDialog({ k: 'view', id: current.id })}>
          <AppointmentForm {...props} appointment={current} onDone={() => setDialog({ k: 'view', id: current.id })} />
        </Modal>
      )}
      {dialog?.k === 'view' && current && (
        <Modal title="Time" onClose={() => setDialog(null)}>
          <AppointmentDetail
            {...props}
            appointment={current}
            onEdit={() => setDialog({ k: 'edit', id: current.id })}
            onDeleted={() => setDialog(null)}
          />
        </Modal>
      )}
    </div>
  );
}
