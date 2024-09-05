import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';
import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react';

interface User {
  passphrase: string;
  setPassphrase: (passphrase: string) => void;
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

const UserContext = createContext<User | null>(null);

export const useUserToken = (): string => {
  const user = useContext(UserContext);
  if (user == null) {
    throw new Error('useUserToken must be used within a UserWrapper');
  }
  return user.passphrase;
};

export const useUserContext = (): User => {
  const user = useContext(UserContext);
  if (user == null) {
    throw new Error('useUserContext must be used within a UserWrapper');
  }
  return user;
};

export const UserWrapper: React.FC<PropsWithChildren> = (props) => {
  const [passphrase, setPassphrase] = useState(() => getOrCreatePassphrase());

  const changePassphrase = useCallback((newPassphrase: string) => {
    localStorage.setItem(PASSPHRASE_KEY, newPassphrase);
    setPassphrase(newPassphrase);
  }, []);

  return (
    <UserContext.Provider
      value={{ passphrase: passphrase, setPassphrase: changePassphrase }}
    >
      {props.children}
    </UserContext.Provider>
  );
};
