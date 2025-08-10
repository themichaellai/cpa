import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { ReadonlyJSONObject, Replicache, WriteTransaction } from 'replicache';

import { useUserToken } from './store/user';
import { IsoDate } from './time';

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
  readonly comment?: string | null;
}

// Helper function to find existing day by date or return the day at the given ID
const findOrGetDayByDate = async (
  tx: WriteTransaction,
  id: string,
  date: string,
): Promise<{ day: FrontendDay | null; dayId: string }> => {
  let day = (await tx.get(`day/${id}`)) as FrontendDay | null;
  let dayId = id;

  // If the specific day doesn't exist, scan for any day with the same date
  if (day == null) {
    const scanner = tx.scan({ prefix: 'day/' });
    const entries = await scanner.entries().toArray();
    for (const [_, value] of entries) {
      const existingDay = value as unknown as FrontendDay;
      if (
        existingDay &&
        typeof existingDay === 'object' &&
        existingDay.date === date
      ) {
        day = existingDay;
        dayId = existingDay.id;
        break;
      }
    }
  }

  return { day, dayId };
};

const mutators = {
  async setDayV2(
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
    const { day, dayId } = await findOrGetDayByDate(tx, id, date);

    if (day == null || typeof day !== 'object') {
      await tx.set(`day/${dayId}`, {
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
        id: dayId,
        comment: null,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${dayId}`, {
        ...day,
        wakeUp,
        dinner,
      } as unknown as ReadonlyJSONObject);
    }
  },
  async setComment(
    tx: WriteTransaction,
    {
      id,
      date,
      comment,
    }: {
      id: string;
      date: string;
      comment: string | null;
    },
  ) {
    const { day, dayId } = await findOrGetDayByDate(tx, id, date);

    if (day == null || typeof day !== 'object') {
      await tx.set(`day/${dayId}`, {
        coffee: null,
        dinner: null,
        wakeUp: null,
        poops: [],
        date,
        id: dayId,
        comment,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${dayId}`, {
        ...day,
        comment,
      } as unknown as ReadonlyJSONObject);
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
    const { day, dayId } = await findOrGetDayByDate(tx, id, date);

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
      id: dayId, // Use the found day ID, not the original one
      date,
      coffee: day?.coffee ?? null,
      dinner: day?.dinner ?? null,
      wakeUp: day?.wakeUp ?? null,
      poops: newPoops,
      comment: day?.comment ?? null,
    } as const satisfies FrontendDay;
    await tx.set(`day/${dayId}`, newDay as unknown as ReadonlyJSONObject);
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
      comment: day?.comment ?? null,
    } as const satisfies FrontendDay;
    await tx.set(`day/${id}`, newDay as unknown as ReadonlyJSONObject);
  },
  async removePoop(
    tx: WriteTransaction,
    { id, poopId }: { id: string; poopId: string },
  ) {
    const day = (await tx.get(`day/${id}`)) as FrontendDay | null;
    if (day == null) {
      return;
    }
    if (typeof day !== 'object') {
      return;
    }
    const poopIdx = day.poops.findIndex((p) => p.id === poopId);
    if (poopIdx === -1) {
      return;
    }
    const newPoops = [...day.poops];
    newPoops.splice(poopIdx, 1);
    const newDay = {
      id,
      date: day.date,
      coffee: day.coffee,
      dinner: day.dinner,
      wakeUp: day.wakeUp,
      poops: newPoops,
      comment: day.comment,
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

const REPLICACHE_ENDPOINT = process.env.NEXT_PUBLIC_REPLICACHE_ENDPOINT;

const newRep = ({
  userKey,
  hashedKey,
}: {
  userKey: string;
  hashedKey: string;
}) => {
  return new Replicache({
    name: `cpa-${hashedKey}`,
    pushURL: `${REPLICACHE_ENDPOINT}/push`,
    pullURL: `${REPLICACHE_ENDPOINT}/pull`,
    auth: `Bearer ${userKey}`,
    mutators,
    pullInterval: 20000,
  });
};

const ReplicacheContext = createContext<
  Replicache<typeof mutators> | 'initializing' | null
>(null);

const useUserTokenHash = (): { userToken: string; hash: string } | null => {
  const userToken = useUserToken();
  const [hash, setHash] = useState<string | null>(null);
  useEffect(() => {
    hashText(userToken).then(setHash);
  }, [userToken]);
  return useMemo(
    () => (hash == null ? null : { userToken, hash }),
    [hash, userToken],
  );
};

export const useReplicache = (): Replicache<typeof mutators> | null => {
  const rep = useContext(ReplicacheContext);
  if (rep == null) {
    throw new Error('useReplicache must be used within a ReplicacheWrapper');
  }
  return rep === 'initializing' ? null : rep;
};

export const ReplicacheWrapper: React.FC<{
  render: () => React.ReactNode;
}> = (props) => {
  const userToken = useUserTokenHash();
  const [rep, setRep] = useState<Replicache<typeof mutators> | 'initializing'>(
    'initializing',
  );
  useEffect(() => {
    if (userToken?.hash == null) {
      return;
    }
    const rep = newRep({
      hashedKey: userToken.hash,
      userKey: userToken.userToken,
    });
    setRep(rep);
    return () => {
      rep.close().then(() => {
        console.log('replicache closed');
      });
    };
  }, [userToken?.hash, userToken?.userToken]);

  useEffect(() => {
    if (rep != null) {
      console.log('got rep', rep);
    }
  }, [rep]);

  return (
    <ReplicacheContext.Provider value={rep}>
      {rep === 'initializing' ? null : props.render()}
    </ReplicacheContext.Provider>
  );
};
