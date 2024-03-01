import { createContext, PropsWithChildren, useEffect, useState } from 'react';
import { Replicache, WriteTransaction } from 'replicache';

import { useUserToken } from './store/user';

const REPLICACHE_LICENSE = 'lbf96f9411a604ca4814d875587aa4826';

const newRep = (userKey: string) =>
  new Replicache({
    name: 'cpa',
    licenseKey: REPLICACHE_LICENSE,
    pushURL: 'https://glorious-mallard-686.convex.site/push',
    pullURL: 'https://glorious-mallard-686.convex.site/pull',
    auth: `Bearer ${userKey}`,
  });

const ReplicacheContext = createContext<Replicache | null>(null);

export const ReplicacheWrapper: React.FC<PropsWithChildren> = (props) => {
  const userToken = useUserToken();
  const [rep, setRep] = useState<Replicache | null>(() => newRep(userToken));
  useEffect(() => {
    console.log('got rep', rep);
  }, [rep]);

  return <>{props.children}</>;
};
