import { useState } from 'react';
import { LocalDate } from '@js-joda/core';
import { Button, Theme } from '@radix-ui/themes';

import { UserWrapper } from './store/user';
import { ReplicacheWrapper } from './replicache';
import Calendar from './Calendar';
import BottomSheet from './BottomSheet';
import './App.module.css';
import SettingsScreen from './Settings';

function App() {
  const [currentScreen, setCurrentScreen] = useState<'main' | 'settings'>(
    'main',
  );

  return (
    <Theme accentColor="purple">
      {currentScreen === 'main' ? (
        <MainApp goToSettings={() => setCurrentScreen('settings')} />
      ) : (
        <Settings />
      )}
    </Theme>
  );
}

function MainApp({ goToSettings }: { goToSettings: () => void }) {
  const [selectedDate, setSelectedDate] = useState<LocalDate>(LocalDate.now());
  const [activeStartDate, setActiveStartDate] = useState<LocalDate | null>(() =>
    selectedDate.withDayOfMonth(1),
  );

  const changeSelectedDate = (date: LocalDate) => {
    setSelectedDate(date);
    setActiveStartDate(date.withDayOfMonth(1));
  };

  return (
    <UserWrapper>
      <ReplicacheWrapper
        render={() => (
          <>
            <Calendar
              value={selectedDate}
              onChange={setSelectedDate}
              activeStartDate={activeStartDate}
              onActiveStartDateChange={setActiveStartDate}
            />
            <BottomSheet
              selectedDate={selectedDate}
              setSelectedDate={changeSelectedDate}
            />
          </>
        )}
      />
      <div className="mx-5 mt-5 mb-3">
        <Button variant="ghost" onClick={() => goToSettings()} size="1">
          ⚙️ Settings
        </Button>
      </div>
    </UserWrapper>
  );
}

function Settings() {
  return (
    <UserWrapper>
      <SettingsScreen />
    </UserWrapper>
  );
}

export default App;
