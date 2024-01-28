import { useState } from 'react';
import { LocalDate } from '@js-joda/core';

import Calendar from './Calendar';
import BottomSheet from './BottomSheet';
import './App.css';

function App() {
  const [selectedDate, setSelectedDate] = useState<LocalDate | null>(null);

  return (
    <>
      <Calendar onChange={setSelectedDate} />
      <BottomSheet selectedDate={selectedDate} />
    </>
  );
}

export default App;
