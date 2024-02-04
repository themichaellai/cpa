import { useState } from 'react';
import { LocalDate } from '@js-joda/core';
import { Theme } from '@radix-ui/themes';

import Calendar from './Calendar';
import BottomSheet from './BottomSheet';
import '@radix-ui/themes/styles.css';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<LocalDate>(LocalDate.now());

  return (
    <Theme accentColor="purple">
      <Calendar value={selectedDate} onChange={setSelectedDate} />
      <BottomSheet selectedDate={selectedDate} />
    </Theme>
  );
}

export default App;
