import { useCallback } from 'react';
import { atom } from 'jotai';
import { useAtom } from 'jotai';

export type IsoDateTime = string & { __type: 'isoDateTime' };
export type IsoDate = string & { __type: 'isoDate' };

interface Poop {
  time: IsoDateTime;
  duringRun: boolean;
}

interface Dinner {
  time: IsoDateTime;
  size: 'small' | 'big';
}

interface Coffee {
  time: IsoDateTime;
}

interface WakeUp {
  time: IsoDateTime;
}

interface Day {
  day: IsoDate;
  wakeUp: WakeUp | null;
  coffee: Coffee | null;
  dinner: Dinner | null;
  poops: Array<Poop>;
}

export const daysPersistedAtom = atom<{
  version: 0;
  days: Array<Day>;
}>({
  version: 0,
  days: [],
});

export const daysAtom = atom(
  (get) => get(daysPersistedAtom).days,
  (_get, set, newDays: Array<Day>) => {
    set(daysPersistedAtom, {
      version: 0,
      days: newDays,
    });
  },
);

export const useDays = (): [Array<Day>, createDay: (d: Day) => void] => {
  const [days, setDays] = useAtom(daysPersistedAtom);
  const createNewDay = useCallback(
    (day: Day) => {
      setDays((state) => ({
        ...state,
        days: [...state.days, day],
      }));
    },
    [setDays],
  );
  return [days.days, createNewDay];
};
