import { useSubscribe } from 'replicache-react';

import { FrontendDay, useReplicache } from '../replicache';

// All days keyed by ISO date (e.g. 2026-10-15).
export function useDays(): ReadonlyMap<string, FrontendDay> {
  const rep = useReplicache();
  const days = useSubscribe(
    rep,
    async (tx) =>
      (await tx
        .scan({ prefix: 'day/' })
        .values()
        .toArray()) as unknown as Array<FrontendDay>,
    { default: [] as Array<FrontendDay> },
  );
  return new Map(days.map((d) => [d.date, d]));
}

// A day worth flagging on the calendar: something was logged, but no poops.
export function isPoopless(day: FrontendDay | undefined): boolean {
  if (day == null || day.poops.length > 0) {
    return false;
  }
  return (
    day.wakeUp != null ||
    day.dinner?.size != null ||
    day.dinner?.time != null ||
    day.coffee?.time != null ||
    (day.comment ?? '').trim() !== ''
  );
}
