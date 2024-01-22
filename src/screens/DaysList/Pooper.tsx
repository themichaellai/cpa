import { useCallback, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { DateTimeFormatter } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';

import Button from '../../components/Button';
import Text from '../../components/Text';
import { Day, useDay } from '../../store/days';
import { IsoDate, IsoDateTime, now, parseDateTime } from '../../time';
import { PURPLE } from '../../colors';

const timePattern = DateTimeFormatter.ofPattern('h:mm a').withLocale(Locale.US);
/** Returns time like "7:30 am" */
const parseAndFormatTime = (dateTime: IsoDateTime) =>
  parseDateTime(dateTime).map((dateTime) => dateTime.format(timePattern));

const Pooper: React.FC<{
  date: IsoDate;
}> = ({ date }) => {
  const [day, setDay] = useDay(date);

  const poops = useMemo(() => day.map((d) => d.poops).orDefault([]), [day]);

  const addPoop = useCallback(() => {
    day
      .map((d): Day => {
        return {
          ...d,
          poops: [
            ...d.poops,
            {
              time: now(),
              run: null,
            },
          ],
        };
      })
      .ifJust((d) => {
        setDay(d);
      });
  }, [day, setDay]);

  const poopEls = useMemo(
    () =>
      poops.map((poop) => {
        return (
          <View key={poop.time} style={styles.poop}>
            <Text size="sm" style={{}}>
              {parseAndFormatTime(poop.time).orDefault('error')}
            </Text>
          </View>
        );
      }),
    [poops],
  );

  return (
    <View style={styles.container}>
      <View style={styles.poops}>{poopEls}</View>
      <View>
        <Button label="add" onPress={addPoop} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignContent: 'stretch',
  },
  poop: {
    backgroundColor: 'white',
    borderColor: PURPLE.P8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 8,
  },
  poops: {
    alignContent: 'stretch',
    justifyContent: 'center',
  },
});

export default Pooper;
