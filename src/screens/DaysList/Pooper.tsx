import { useCallback, useMemo } from 'react';
import { StyleSheet, Switch, View } from 'react-native';
import { DateTimeFormatter } from '@js-joda/core';
import { Locale } from '@js-joda/locale_en';

import Button from '../../components/Button';
import Text from '../../components/Text';
import { Day, Poop, useDay } from '../../store/days';
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
      poops.map((poop, idx) => {
        const toggleRun = (val: boolean) => {
          day
            .map((d): Day => {
              const newPoop: Poop = {
                ...poop,
                run: !val
                  ? null
                  : {
                      timeIntoRunMinutes: 0,
                    },
              };
              return {
                ...d,
                poops: [
                  ...d.poops.slice(0, idx),
                  newPoop,
                  ...d.poops.slice(idx + 1),
                ],
              };
            })
            .ifJust((d) => {
              setDay(d);
            });
        };

        return (
          <View key={poop.time} style={styles.poop}>
            <View style={styles.controlContainer}>
              <Text size="sm" style={styles.controlLabel}>
                Time
              </Text>
              <Text size="sm" style={styles.controlValue}>
                {parseAndFormatTime(poop.time).orDefault('error')}
              </Text>
            </View>
            <View
              style={[styles.controlContainer, styles.controlContainerLast]}
            >
              <Text size="sm" style={styles.controlLabel}>
                On run
              </Text>
              <Switch value={poop.run != null} onValueChange={toggleRun} />
            </View>
          </View>
        );
      }),
    [poops, setDay, day],
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
  controlContainer: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 15,
  },
  controlContainerLast: {
    marginBottom: 0,
  },
  controlLabel: {
    flex: 1,
  },
  controlValue: {
    flex: 1,
    textAlign: 'right',
  },
  poop: {
    backgroundColor: PURPLE.P10,
    borderColor: PURPLE.P8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
    paddingHorizontal: 15,
    paddingVertical: 15,
  },
  poops: {
    alignContent: 'stretch',
    justifyContent: 'center',
  },
});

export default Pooper;
