import { useMemo } from 'react';
import { atom, useAtom } from 'jotai';
import { atomWithStorage, createJSONStorage, loadable } from 'jotai/utils';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { IsoDate, IsoDateTime } from '../time';
import { Just, Nothing } from 'purify-ts/Maybe';

export interface Poop {
  time: IsoDateTime;
  run: {
    timeIntoRunMinutes: number;
  } | null;
}

export interface Dinner {
  time: IsoDateTime | null;
  size: 'regular' | 'big' | null;
}

interface Coffee {
  time: IsoDateTime | null;
  amount: number | null;
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

interface StoredDays {
  version: 0;
  days: DaysMap;
}

type DaysMap = Partial<Record<IsoDate, Day>>;
// TODO: add validation when reading from storage
const storage = createJSONStorage<StoredDays>(() => AsyncStorage);
export const daysPersistedAtom = atomWithStorage<StoredDays>(
  'days',
  {
    version: 0,
    days: {},
  },
  storage,
);
const daysPersistedAtomLoadable = loadable(daysPersistedAtom);

export const useDayAtom = (date: IsoDate) => {
  return useMemo(() => {
    return atom(
      (get) => {
        const res = get(daysPersistedAtomLoadable);
        if (res.state === 'loading' || res.state === 'hasError') {
          return res;
        }
        return {
          ...res,
          data: res.data.days[date] ?? DEFAULT_DAY(date),
        };
      },
      (_get, set, newDay: Day) => {
        set(daysPersistedAtom, async (stateP) => {
          const state = await stateP;
          return {
            ...state,
            days: {
              ...state.days,
              [date]: newDay,
            },
          };
        });
      },
    );
  }, [date]);
};

export const useDay = (d: IsoDate) => {
  const dayAtom = useDayAtom(d);
  const [dayStateLoadable, setDay] = useAtom(dayAtom);
  const day = useMemo(
    () =>
      dayStateLoadable.state === 'hasData'
        ? Just(dayStateLoadable.data)
        : Nothing,
    [dayStateLoadable],
  );
  return [day, setDay] as const;
};
