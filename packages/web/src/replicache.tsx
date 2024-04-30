import {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useState,
} from 'react';
import { Replicache, WriteTransaction } from 'replicache';

import { useUserToken } from './store/user';
import { FrontendDay } from '../convex/days';

const REPLICACHE_LICENSE = 'lbf96f9411a604ca4814d875587aa4826';

interface AddDayMutation {
  date: string;
  id: string;
}

const mutators = {
  async addDay(tx: WriteTransaction, { date, id }: AddDayMutation) {
    await tx.set(`day/${id}`, {
      coffee: null,
      dinner: null,
      wakeUp: null,
      poops: [],
      date,
    });
  },
  async setDay(
    tx: WriteTransaction,
    {
      id,
      wakeUp,
      date,
    }: {
      id: string;
      date: string;
      wakeUp: {
        time: string;
      } | null;
    },
  ) {
    const day = await tx.get(`day/${id}`);
    if (day == null || typeof day !== 'object') {
      await tx.set(`day/${id}`, {
        coffee: null,
        dinner: null,
        wakeUp,
        poops: [],
        date,
        id,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${id}`, {
        ...day,
        wakeUp,
      });
    }
  },
  async setDinner(
    tx: WriteTransaction,
    {
      id,
      date,
      size,
    }: {
      id: string;
      date: string;
      size: null | 'regular' | 'big';
    },
  ) {
    const day = await tx.get(`day/${id}`);
    if (day == null || typeof day !== 'object' || 'length' in day) {
      await tx.set(`day/${id}`, {
        coffee: null,
        dinner: {
          size,
          time: null,
        },
        wakeUp: null,
        poops: [],
        date,
        id,
      } satisfies FrontendDay);
    } else {
      await tx.set(`day/${id}`, {
        ...day,
        dinner: {
          ...(typeof day.dinner === 'object' && !('length' in day)
            ? day.dinner
            : {
                time: null,
              }),
          size,
        },
      });
    }
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
    //pullInterval: 5000,
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
