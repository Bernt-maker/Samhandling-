import { addDays, dateKey, dutyOn, range } from '../lib/dates';
import type { ViewProps } from './Main';
import { AppointmentItem } from './AppointmentItem';
import { Dot } from './ui';

export function Overview({ data, me, openAppointment }: ViewProps) {
  const today = dateKey(new Date());
  const now = new Date().toISOString();
  const { members, appointments, duties } = data;
  const onDuty = dutyOn(duties, today);
  const onDutyMember = members.find((m) => m.id === onDuty?.memberId);
  const nextDuties = duties.filter((d) => d.startDate > today).slice(0, 3);
  const myNext = duties.find((d) => d.memberId === me.id && d.endDate >= today);
  const upcoming = appointments.filter((a) => a.startsAt >= now && a.data.status !== 'avlyst');
  const soon = upcoming.filter((a) => a.startsAt.slice(0, 10) <= addDays(today, 14));
  const unassigned = upcoming.filter((a) => !a.data.escortId);

  return (
    <div className="stack gap">
      <section className="card duty-now" style={{ borderColor: onDutyMember?.color }}>
        <div className="muted small">Har vakt nå</div>
        {onDutyMember && onDuty ? (
          <>
            <div className="duty-name">
              <Dot color={onDutyMember.color} /> {onDutyMember.name}
            </div>
            <div className="muted small">{range(onDuty.startDate, onDuty.endDate)}</div>
            {onDuty.note && <p className="small">{onDuty.note}</p>}
          </>
        ) : (
          <div className="warn">Ingen har vakt i dag</div>
        )}
        {nextDuties.length > 0 && (
          <div className="next-duties small">
            Deretter:{' '}
            {nextDuties.map((d, i) => {
              const m = members.find((x) => x.id === d.memberId);
              return (
                <span key={d.id}>
                  {i > 0 && ', '}
                  {m?.name ?? '?'} ({range(d.startDate, d.endDate)})
                </span>
              );
            })}
          </div>
        )}
        {me.role !== 'lege' && (
          <div className="small mine">
            {myNext ? <>Din neste vakt: <b>{range(myNext.startDate, myNext.endDate)}</b></> : 'Du har ingen kommende vakter.'}
          </div>
        )}
      </section>

      {unassigned.length > 0 && me.role !== 'lege' && (
        <p className="notice">
          {unassigned.length === 1 ? '1 kommende time mangler' : `${unassigned.length} kommende timer mangler`} noen som
          følger mor.
        </p>
      )}

      <section>
        <h2>Neste to uker</h2>
        {soon.length === 0 ? (
          <p className="muted">Ingen timer de neste to ukene.</p>
        ) : (
          <ul className="list">
            {soon.map((a) => (
              <AppointmentItem key={a.id} a={a} members={members} onOpen={openAppointment} />
            ))}
          </ul>
        )}
      </section>

      {upcoming.length > soon.length && (
        <section>
          <h2>Senere</h2>
          <ul className="list">
            {upcoming.slice(soon.length, soon.length + 10).map((a) => (
              <AppointmentItem key={a.id} a={a} members={members} onOpen={openAppointment} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
