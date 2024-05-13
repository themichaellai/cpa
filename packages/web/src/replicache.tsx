import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { ReadonlyJSONObject, Replicache, WriteTransaction } from 'replicache';

import { useUserToken } from './store/user';
import { IsoDate } from './time';

const REPLICACHE_LICENSE = 'lbf96f9411a604ca4814d875587aa4826';

interface Poop {
  readonly id: string;
  readonly time: string;
  readonly run: {
    readonly timeIntoRunMinutes: number;
  } | null;
}

export interface FrontendDay {
  readonly id: string;
  readonly coffee: {
    readonly time: string | null;
  } | null;
  readonly date: string;
  readonly dinner: {
    readonly time: string | null;
    readonly size: 'regular' | 'big' | null;
  } | null;
  readonly wakeUp: {
    readonly time: string;
  } | null;
  readonly poops: ReadonlyArray<Poop>;
}

const mutators = {
  async setDay(
    tx: WriteTransaction,
    {
      id,
      wakeUp,
      date,
      dinner,
    }: {
      id: string;
      date: string;
      wakeUp: {
        time: string;
      } | null;
      dinner: {
        size: 'regular' | 'big' | null;
      } | null;
    },
  ) {
    const day = await tx.get(`day/${id}`);
    if (day == null || typeof day !== 'object') {
      await tx.set(`day/${id}`, {
        coffee: null,
        dinner:
          dinner == null
            ? null
            : {
                size: dinner.size,
                time: null,
              },
        wakeUp,
        poops: [],
        date,
        id,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${id}`, {
        ...day,
        wakeUp,
        dinner,
      });
    }
  },
  async addPoop(
    tx: WriteTransaction,
    {
      id,
      date,
      poopId,
      time,
    }: { id: string; date: IsoDate; poopId: string; time: string },
  ) {
    const day = (await tx.get(`day/${id}`)) as FrontendDay | null;
    if (day != null && typeof day !== 'object') {
      return;
    }
    if (day != null && day.date !== date) {
      return;
    }
    const newPoops: ReadonlyArray<Poop> = [
      ...(day?.poops ?? []),
      {
        id: poopId,
        time,
        run: null,
      },
    ];
    const newDay = {
      id,
      date,
      coffee: day?.coffee ?? null,
      dinner: day?.dinner ?? null,
      wakeUp: day?.wakeUp ?? null,
      poops: newPoops,
    } as const satisfies FrontendDay;
    await tx.set(`day/${id}`, newDay as unknown as ReadonlyJSONObject);
  },
  async setPoop(
    tx: WriteTransaction,
    {
      id,
      date,
      poopId,
      time,
      onRun,
    }: {
      id: string;
      date: IsoDate;
      poopId: string;
      time: string;
      onRun: boolean;
    },
  ) {
    const day = (await tx.get(`day/${id}`)) as FrontendDay | null;
    if (day == null) {
      return;
    }
    if (typeof day !== 'object' || day.date !== date) {
      return;
    }
    const poopIdx = day.poops.findIndex((p) => p.id === poopId);
    if (poopIdx === -1) {
      return;
    }
    const newPoops = [...day.poops];
    newPoops.splice(poopIdx, 1, {
      ...newPoops[poopIdx],
      time,
      run: onRun ? { timeIntoRunMinutes: 0 } : null,
    });
    const newDay = {
      id,
      date,
      coffee: day?.coffee ?? null,
      dinner: day?.dinner ?? null,
      wakeUp: day?.wakeUp ?? null,
      poops: newPoops,
    } as const satisfies FrontendDay;
    await tx.set(`day/${id}`, newDay as unknown as ReadonlyJSONObject);
  },
};

const hashText = async (text: string): Promise<string> => {
  const msgUint8 = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return hashHex;
};

const newRep = async (userKey: string) => {
  const hashedKey = await hashText(userKey);
  return new Replicache({
    name: `cpa-${hashedKey}`,
    licenseKey: REPLICACHE_LICENSE,
    //pushURL: 'https://glorious-mallard-686.convex.site/push',
    //pullURL: 'https://glorious-mallard-686.convex.site/pull',
    pushURL: 'http://localhost:8080/push',
    pullURL: 'http://localhost:8080/pull',
    auth: `Bearer ${userKey}`,
    mutators,
    pullInterval: 5000,
  });
};

const ReplicacheContext = createContext<
  Replicache<typeof mutators> | 'initializing' | null
>(null);

export const useReplicache = (): Replicache<typeof mutators> | null => {
  const rep = useContext(ReplicacheContext);
  if (rep == null) {
    throw new Error('useReplicache must be used within a ReplicacheWrapper');
  }
  return rep === 'initializing' ? null : rep;
};

export const ReplicacheWrapper: React.FC<PropsWithChildren> = (props) => {
  const userToken = useUserToken();
  const [rep, setRep] = useState<Replicache<typeof mutators> | 'initializing'>(
    'initializing',
  );
  useEffect(() => {
    newRep(userToken).then((r) => setRep(r));
  }, [userToken]);
  useEffect(() => {
    if (rep != null) {
      console.log('got rep', rep);
    }
  }, [rep]);

  return (
    <ReplicacheContext.Provider value={rep}>
      {props.children}
    </ReplicacheContext.Provider>
  );
};
