import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import BottomSheet from '@gorhom/bottom-sheet';
import { useAtom } from 'jotai';
import { Either } from 'purify-ts/Either';
import { Maybe } from 'purify-ts/Maybe';

import { PURPLE } from '../../colors';
import { now, IsoDate, parseDateTime, IsoDateTime } from '../../time';
import Text from '../../components/Text';
import Button from '../../components/Button';
import { useDayAtom } from '../../store/days';

const dateToDisplay = (date: IsoDate): string => {
  const dateObj = new Date(date);
  return dateObj.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dt: IsoDateTime): Either<Error, string> => {
  const parsed = parseDateTime(dt);
  return parsed.map((dateTime) => {
    // Pick out hour, min, am/pm without format function
    return `${dateTime.hour()}:${dateTime.minute()} ${
      dateTime.hour() < 12 ? 'AM' : 'PM'
    }`;
  });
};

const DaySheet: React.FC<{
  topY: number;
  date: IsoDate;
}> = ({ topY, date }) => {
  const dimensions = useWindowDimensions();
  const dayAtom = useDayAtom(date);
  const [day, setDay] = useAtom(dayAtom);

  const snapPoints = useMemo(
    () => [dimensions.height - topY],
    [topY, dimensions.height],
  );

  const setWakeUpToNow = useCallback(() => {
    setDay({
      ...day,
      wakeUp: {
        time: now(),
      },
    });
  }, [day, setDay]);
  const unsetWakeUp = useCallback(() => {
    setDay({
      ...day,
      wakeUp: null,
    });
  }, [day, setDay]);

  const wakeUpTableValueEl = useMemo(
    () =>
      Maybe.fromNullable(day.wakeUp)
        .toEither('no wake up set')
        .chain((wakeUp) => formatTime(wakeUp.time))
        .caseOf({
          Left: () => (
            <Button
              label="set"
              onPress={() => {
                setWakeUpToNow();
              }}
            />
          ),
          Right: (dateTimeStr) => (
            <Text
              onPress={() => {
                unsetWakeUp();
              }}
              size="sm"
            >
              {dateTimeStr}
            </Text>
          ),
        }),
    [day, setWakeUpToNow, unsetWakeUp],
  );

  return (
    <BottomSheet index={0} snapPoints={snapPoints} style={styles.container}>
      <Text size="lg" style={styles.title}>
        {dateToDisplay(date)}
      </Text>
      <View style={styles.formContainer}>
        <View style={styles.formLabel}>
          <Text size="sm">Wake up</Text>
        </View>
        <View style={styles.formValue}>{wakeUpTableValueEl}</View>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.formLabel}>
          <Text size="sm">Dinner</Text>
        </View>
        <View style={styles.formValue}>
          <Text size="sm">World</Text>
        </View>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.formLabel}>
          <Text size="sm">Coffee</Text>
        </View>
        <View style={styles.formValue}>
          <Text size="sm">World</Text>
        </View>
      </View>
      <View style={styles.formContainer}>
        <View style={styles.formLabel}>
          <Text size="sm">Poops</Text>
        </View>
        <View style={styles.formValue}>
          <Text size="sm"></Text>
        </View>
      </View>
    </BottomSheet>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    borderRadius: 10,
    paddingHorizontal: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.5,
    shadowRadius: 5,
  },
  formContainer: {
    backgroundColor: PURPLE.P10,
    borderColor: PURPLE.P9,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    marginBottom: 10,
    padding: 20,
  },
  formLabel: {
    justifyContent: 'center',
    paddingVertical: 4,
    width: '30%',
  },
  formValue: {
    alignItems: 'flex-start',
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    marginBottom: 20,
    marginTop: 7,
  },
});

export default memo(DaySheet);
