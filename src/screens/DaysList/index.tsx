import {
  ComponentProps,
  useCallback,
  useMemo,
  useState,
  Suspense,
} from 'react';
import { LayoutChangeEvent, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';

import { IsoDate } from '../../time';
import { PURPLE } from '../../colors';
import Text from '../../components/Text';
import DaySheet from './DaySheet';

type CalendarProps = ComponentProps<typeof Calendar>;
const calendarTheme: CalendarProps['theme'] = {
  todayTextColor: PURPLE.P4,
  agendaTodayColor: PURPLE.P4,
  textDayFontWeight: '500',
  selectedDayBackgroundColor: PURPLE.P10,
  selectedDayTextColor: PURPLE.P2,
  textMonthFontWeight: '500',
  arrowColor: PURPLE.P4,
};

const DaysList: React.FC = () => {
  const [selectedDate, setSelectedDate] = useState<IsoDate>(
    new Date().toISOString().split('T')[0] as IsoDate,
  );

  const markedDates = useMemo(
    (): CalendarProps['markedDates'] => ({
      [selectedDate]: { selected: true },
    }),
    [selectedDate],
  );

  const onDayPress = useCallback<NonNullable<CalendarProps['onDayPress']>>(
    (day) => {
      setSelectedDate(day.dateString as IsoDate);
    },
    [],
  );

  const { bottom: calendarBottom, onLayout: onCalendarLayout } =
    useElementBottom();

  const safeAreaEdges = useMemo(() => ['top' as const], []);
  return (
    <>
      <SafeAreaView edges={safeAreaEdges}>
        <View onLayout={onCalendarLayout}>
          <Calendar
            theme={calendarTheme}
            onDayPress={onDayPress}
            markedDates={markedDates}
          />
        </View>
      </SafeAreaView>
      {calendarBottom == null ? null : (
        <Suspense fallback={<Text size="sm">loading</Text>}>
          <DaySheet topY={calendarBottom} date={selectedDate} />
        </Suspense>
      )}
    </>
  );
};

const useElementBottom = () => {
  const [bottom, setBottom] = useState<number | null>(null);
  const onLayout = useCallback(
    ({ nativeEvent: { layout } }: LayoutChangeEvent) => {
      setBottom(layout.y + layout.height);
    },
    [setBottom],
  );
  return { bottom, onLayout };
};

export default DaysList;
