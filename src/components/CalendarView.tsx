import { useState } from 'react';
import { dateKey, dutyOn, fmt, monthGrid, parseDateKey } from '../lib/dates';
import { KIND_ICON } from '../lib/labels';
import type { ViewProps } from './Main';
import { AppointmentItem } from './AppointmentItem';
import { Dot } from './ui';

const WEEKDAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn'];

export function CalendarView({ data, canEdit, openAppointment, newAppointment }: ViewProps) {
  const today = dateKey(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [selected, setSelected] = useState(today);
  const { members, appointments, duties } = data;

  const byDay = new Map<string, typeof appointments>();
  for (const a of appointments) {
    const k = dateKey(new Date(a.startsAt));
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }

  const move = (delta: number) =>
    setCursor(({ y, m }) => {
      const d = new Date(y, m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });

  const days = monthGrid(cursor.y, cursor.m);
  const dayList = byDay.get(selected) ?? [];
  const selDuty = dutyOn(duties, selected);
  const selDutyMember = members.find((m) => m.id === selDuty?.memberId);

  return (
    <div className="stack gap">
      <div className="month-head">
        <button className="icon" aria-label="Forrige måned" onClick={() => move(-1)}>‹</button>
        <h2>{fmt.monthYear(cursor.y, cursor.m)}</h2>
        <button className="icon" aria-label="Neste måned" onClick={() => move(1)}>›</button>
      </div>
      <button
        className="ghost small today-btn"
        onClick={() => {
          const d = new Date();
          setCursor({ y: d.getFullYear(), m: d.getMonth() });
          setSelected(today);
        }}
      >
        I dag
      </button>

      <div className="month">
        {WEEKDAYS.map((w) => (
          <div key={w} className="wd">{w}</div>
        ))}
        {days.map((k) => {
          const d = parseDateKey(k);
          const inMonth = d.getMonth() === cursor.m;
          const duty = dutyOn(duties, k);
          const dutyColor = members.find((m) => m.id === duty?.memberId)?.color;
          const appts = byDay.get(k) ?? [];
          return (
            <button
              key={k}
              className={['day', inMonth ? '' : 'out', k === today ? 'today' : '', k === selected ? 'sel' : ''].join(' ')}
              onClick={() => setSelected(k)}
              aria-label={`${fmt.weekdayDate(d)}${appts.length ? `, ${appts.length} timer` : ''}`}
            >
              <span className="num">{d.getDate()}</span>
              <span className="icons">
                {appts.slice(0, 2).map((a) => (
                  <span key={a.id} className={a.data.status === 'avlyst' ? 'strike' : ''}>{KIND_ICON[a.data.kind]}</span>
                ))}
                {appts.length > 2 && <span className="more">+{appts.length - 2}</span>}
              </span>
              {dutyColor && <span className="duty-bar" style={{ background: dutyColor }} />}
            </button>
          );
        })}
      </div>

      <section>
        <div className="row between">
          <h3>{fmt.weekdayDate(parseDateKey(selected))}</h3>
          {canEdit && (
            <button className="small" onClick={() => newAppointment(selected)}>+ Time</button>
          )}
        </div>
        <p className="small">
          Vakt:{' '}
          {selDutyMember ? (
            <>
              <Dot color={selDutyMember.color} /> {selDutyMember.name}
            </>
          ) : (
            <span className="warn">ingen</span>
          )}
        </p>
        {dayList.length === 0 ? (
          <p className="muted">Ingen timer denne dagen.</p>
        ) : (
          <ul className="list">
            {dayList.map((a) => (
              <AppointmentItem key={a.id} a={a} members={members} onOpen={openAppointment} showDate={false} />
            ))}
          </ul>
        )}
      </section>

      <div className="legend small">
        {members
          .filter((m) => m.role !== 'lege')
          .map((m) => (
            <span key={m.id}>
              <Dot color={m.color} /> {m.name}
            </span>
          ))}
      </div>
    </div>
  );
}
