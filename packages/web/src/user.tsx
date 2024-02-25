import { createContext, PropsWithChildren, useContext, useState } from 'react';
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

interface User {
  passphrase: string;
}

const PASSPHRASE_KEY = 'cpa-user';

const getOrCreatePassphrase = (): string => {
  const stored = localStorage.getItem(PASSPHRASE_KEY);
  if (stored != null) {
    return stored;
  }
  const newPassphrase = bip39.generateMnemonic(wordlist, 128);
  localStorage.setItem(PASSPHRASE_KEY, newPassphrase);
  return newPassphrase;
};

const UserContext = createContext<User>({
  passphrase: getOrCreatePassphrase(),
});

export const useUserToken = (): string => {
  const user = useContext(UserContext);
  return user.passphrase;
};

export const UserWrapper: React.FC<PropsWithChildren> = (props) => {
  const [passphrase] = useState(() => getOrCreatePassphrase());
  return (
    <UserContext.Provider value={{ passphrase: passphrase }}>
      {props.children}
    </UserContext.Provider>
  );
};
