import { useCallback, useMemo } from 'react';
import { atom } from 'jotai';
import { useAtom } from 'jotai';

import { IsoDate, IsoDateTime } from '../time';

interface Poop {
  time: IsoDateTime;
  run: {
    timeIntoRunMinutes: number;
  } | null;
}

interface Dinner {
  time: IsoDateTime;
  size: 'regular' | 'big';
}

interface Coffee {
  time: IsoDateTime;
  amount: number;
}

interface WakeUp {
  time: IsoDateTime;
}

export interface Day {
  date: IsoDate;
  wakeUp: WakeUp | null;
  coffee: Coffee | null;
  dinner: Dinner | null;
  poops: Array<Poop>;
}

const DEFAULT_DAY = (date: IsoDate): Day => ({
  date,
  wakeUp: null,
  coffee: null,
  dinner: null,
  poops: [],
});

type DaysMap = Partial<Record<IsoDate, Day>>;
export const daysPersistedAtom = atom<{
  version: 0;
  days: DaysMap;
}>({
  version: 0,
  days: {},
});

export const daysAtom = atom(
  (get) => get(daysPersistedAtom).days,
  (_get, set, newDays: DaysMap) => {
    set(daysPersistedAtom, {
      version: 0,
      days: newDays,
    });
  },
);

export const useDays = (): [DaysMap, createDay: (d: Day) => void] => {
  const [days, setDays] = useAtom(daysPersistedAtom);
  const createNewDay = useCallback(
    (day: Day) => {
      setDays((state) => ({
        ...state,
        days: { ...state.days, [day.date]: day },
      }));
    },
    [setDays],
  );
  return [days.days, createNewDay];
};

export const useDayAtom = (date: IsoDate) => {
  return useMemo(() => {
    return atom(
      (get) => get(daysPersistedAtom).days[date] ?? DEFAULT_DAY(date),
      (_get, set, newDay: Day) => {
        set(daysPersistedAtom, (s) => ({
          ...s,
          days: {
            ...s.days,
            [date]: newDay,
          },
        }));
      },
    );
  }, [date]);
};
