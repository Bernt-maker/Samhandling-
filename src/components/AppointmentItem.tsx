import type { Appointment, Member } from '../types';
import { fmt } from '../lib/dates';
import { KIND_ICON, appointmentTitle } from '../lib/labels';
import { Dot } from './ui';

export function AppointmentItem({
  a,
  members,
  onOpen,
  showDate = true,
}: {
  a: Appointment;
  members: Member[];
  onOpen: (id: string) => void;
  showDate?: boolean;
}) {
  const start = new Date(a.startsAt);
  const escort = a.data.escortId ? members.find((m) => m.id === a.data.escortId) : undefined;
  return (
    <li>
      <button className={`appt ${a.data.status}`} onClick={() => onOpen(a.id)}>
        <span className="appt-icon" aria-hidden>{KIND_ICON[a.data.kind]}</span>
        <span className="appt-main">
          <span className="appt-title">{appointmentTitle(a.data)}</span>
          <span className="muted small">
            {showDate && `${fmt.weekdayDate(start)} · `}kl. {fmt.time(start)}
            {a.data.location && ` · ${a.data.location}`}
          </span>
        </span>
        <span className="appt-escort small">
          {escort ? (
            <>
              <Dot color={escort.color} /> {escort.name}
            </>
          ) : a.data.status === 'planlagt' ? (
            <span className="warn">Følge?</span>
          ) : null}
        </span>
      </button>
    </li>
  );
}
