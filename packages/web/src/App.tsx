import { useState } from 'react';
import { LocalDate } from '@js-joda/core';
import { Button, Theme } from '@radix-ui/themes';
import Link from 'next/link';

import { UserWrapper } from './store/user';
import { ReplicacheWrapper } from './replicache';
import Calendar from './Calendar';
import { useCurrentDate } from './time';
import BottomSheet from './BottomSheet';
import './App.module.css';

function App() {
  return (
    <Theme accentColor="purple" hasBackground={false}>
      <MainApp />
    </Theme>
  );
}

function MainApp() {
  const today = useCurrentDate();
  const [selectedDate, setSelectedDate] = useState<LocalDate>(today);
  const [activeStartDate, setActiveStartDate] = useState<LocalDate>(() =>
    selectedDate.withDayOfMonth(1),
  );

  const changeSelectedDate = (date: LocalDate) => {
    setSelectedDate(date);
    setActiveStartDate(date.withDayOfMonth(1));
  };

  return (
    <UserWrapper>
      <div className="flex-1 max-w-md m-auto mt-2">
        <div className="mx-5 mt-5 mb-3">
          <ReplicacheWrapper
            render={() => (
              <>
                <Calendar
                  value={selectedDate}
                  onChange={changeSelectedDate}
                  today={today}
                  activeStartDate={activeStartDate}
                  onActiveStartDateChange={setActiveStartDate}
                />
                <BottomSheet selectedDate={selectedDate} className="mt-5" />
              </>
            )}
          />
        </div>
        <div className="mx-5 mt-5 mb-3">
          <Button asChild variant="ghost" size="1">
            <Link href="/settings">⚙️ Settings</Link>
          </Button>
        </div>
      </div>
    </UserWrapper>
  );
}

export default App;
