import { useState } from 'react';
import { LocalDate } from '@js-joda/core';
import { Theme } from '@radix-ui/themes';

import { UserWrapper } from './store/user';
import { ReplicacheWrapper } from './replicache';
import Calendar from './Calendar';
import BottomSheet from './BottomSheet';
import './App.module.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<LocalDate>(LocalDate.now());

  return (
    <UserWrapper>
      <ReplicacheWrapper>
        <Theme accentColor="purple">
          <Calendar value={selectedDate} onChange={setSelectedDate} />
          <BottomSheet selectedDate={selectedDate} />
        </Theme>
      </ReplicacheWrapper>
    </UserWrapper>
  );
}

export default App;
