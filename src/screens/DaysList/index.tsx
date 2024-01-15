import { ComponentProps, useCallback, useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';

//import { IsoDate, useDays } from '../../store/days';
import { PURPLE } from '../../colors';

type CalendarProps = ComponentProps<typeof Calendar>;
const calendarTheme: CalendarProps['theme'] = {
  todayTextColor: PURPLE.P4,
  agendaTodayColor: PURPLE.P4,
  textDayFontWeight: '500',
  selectedDayBackgroundColor: PURPLE.P8,
  selectedDayTextColor: PURPLE.P4,
  textMonthFontWeight: '500',
  arrowColor: PURPLE.P4,
};

const DaysList: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split('T')[0],
  );

  const markedDates = useMemo(
    (): CalendarProps['markedDates'] => ({
      [selectedDate]: { selected: true },
    }),
    [selectedDate],
  );

  const onDayPress = useCallback<CalendarProps['onDayPress']>((day) => {
    setSelectedDate(day.dateString);
  }, []);

  return (
    <SafeAreaView>
      <Calendar
        theme={calendarTheme}
        onDayPress={onDayPress}
        markedDates={markedDates}
      />
    </SafeAreaView>
  );
};

export default DaysList;
