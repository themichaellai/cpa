import { useCallback, useMemo } from 'react';
import { LocalDate, LocalTime, ZoneId, ZonedDateTime } from '@js-joda/core';
import { Button, Card, Flex, Switch } from '@radix-ui/themes';

import { useDay, Day, Poop } from './store';
import { IsoDateTime, now } from './time';
import TimePicker from './components/TimePicker';

const setPoopAtIdx = (poops: Poop[], idx: number, newPoop: Poop): Poop[] => [
  ...poops.slice(0, idx),
  newPoop,
  ...poops.slice(idx + 1),
];

const Pooper: React.FC<{
  date: LocalDate;
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
                poops: setPoopAtIdx(d.poops, idx, newPoop),
              };
            })
            .ifJust((d) => {
              setDay(d);
            });
        };

        const changeTime = (timeOffsetMillis: number) => {
          day
            .map((d) => {
              const newTime: IsoDateTime = ZonedDateTime.of(
                date,
                LocalTime.ofSecondOfDay(Math.floor(timeOffsetMillis / 1000)),
                ZoneId.systemDefault(),
              ).toString() as IsoDateTime;
              return {
                ...d,
                poops: setPoopAtIdx(d.poops, idx, {
                  ...poop,
                  time: newTime,
                }),
              };
            })
            .ifJust((d) => {
              setDay(d);
            });
        };

        return (
          <Card
            key={`${day}-${idx}`}
            className={poops.length === idx + 1 ? '' : 'mb-2'}
          >
            <Flex align="center" gap="1" className="mb-4">
              <div className="w-1/4">Time</div>
              <div className="flex-1 text-right">
                <TimePicker time={poop.time} onChange={changeTime} />
              </div>
            </Flex>
            <Flex align="center" gap="1">
              <div className="w-1/4">On run</div>
              <div className="flex-1 text-right">
                <Switch
                  checked={poop.run != null}
                  onCheckedChange={toggleRun}
                  variant="soft"
                  size="3"
                />
              </div>
            </Flex>
          </Card>
        );
      }),
    [poops, setDay, day, date],
  );

  return (
    <>
      <div className="mb-2">{poopEls}</div>
      <Button onClick={addPoop} variant="soft">
        Add poop
      </Button>
    </>
  );
};

export default Pooper;
