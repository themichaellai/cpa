import { Button, Heading, Text, TextArea } from '@radix-ui/themes';
import { useState } from 'react';

import { useUserContext } from './store/user';

function SettingsScreen({ goBack }: { goBack: () => void }) {
  const { passphrase, setPassphrase } = useUserContext();

  const [newPassphrase, setNewPassphrase] = useState<string>(passphrase);
  const [showingSuccess, setShowingSuccess] = useState(false);

  const changeNewPassphrase = (p: string) => {
    setNewPassphrase(p);
    setShowingSuccess(false);
  };

  const submitNewPassphrase = () => {
    setPassphrase(newPassphrase);
    setShowingSuccess(true);
  };

  return (
    <div className="max-w-screen-md m-auto mt-4 mx-7">
      <Heading
        as="h1"
        className="mb-1.5 before:content-['‹'] before:w-4 -ml-4 flex cursor-pointer"
        onClick={goBack}
      >
        Settings
      </Heading>
      <TextArea
        size="1"
        className="mb-1"
        value={newPassphrase}
        onChange={(e) => {
          changeNewPassphrase(e.target.value);
        }}
      />
      <div className="flex gap-1 items-center">
        <Button variant="soft" size="1" onClick={submitNewPassphrase}>
          Set passphrase
        </Button>

        {showingSuccess ? <Text size="1">Success</Text> : null}
      </div>
    </div>
  );
}

export default SettingsScreen;
