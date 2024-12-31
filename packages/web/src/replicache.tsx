import { createContext, useContext, useEffect, useState, useMemo } from 'react';
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
  readonly comment?: string | null;
}

const mutators = {
  async setDay(
    tx: WriteTransaction,
    {
      id,
      wakeUp,
      date,
      dinner,
      comment,
    }: {
      id: string;
      date: string;
      wakeUp: {
        time: string;
      } | null;
      dinner: {
        size: 'regular' | 'big' | null;
      } | null;
      comment: string | null;
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
        comment,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${id}`, {
        ...day,
        wakeUp,
        dinner,
        comment,
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
      comment: day?.comment ?? null,
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

const REPLICACHE_ENDPOINT = import.meta.env.VITE_REPLICACHE_ENDPOINT;

const newRep = ({
  userKey,
  hashedKey,
}: {
  userKey: string;
  hashedKey: string;
}) => {
  return new Replicache({
    name: `cpa-${hashedKey}`,
    licenseKey: REPLICACHE_LICENSE,
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
