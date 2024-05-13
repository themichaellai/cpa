import { useCallback, useMemo } from 'react';
import {
  DateTimeFormatter,
  LocalDate,
  LocalTime,
  ZoneId,
  ZonedDateTime,
} from '@js-joda/core';
import { Button, Card, ContextMenu, Flex, Switch } from '@radix-ui/themes';
import clsx from 'clsx';
import { useSubscribe } from 'replicache-react';
import { Maybe, Nothing } from 'purify-ts/Maybe';

import { useDay } from './store';
import { IsoDate, IsoDateTime, now } from './time';
import { useReplicache, FrontendDay } from './replicache';
import TimePicker from './components/TimePicker';

const Pooper: React.FC<{
  date: LocalDate;
}> = ({ date }) => {
  const rep = useReplicache();
  const dayRep = useSubscribe(
    rep,
    async (tx): Promise<Maybe<FrontendDay>> => {
      const allDays = (await tx
        .scan({
          prefix: `day/`,
        })
        .toArray()) as unknown as Array<FrontendDay>;
      const day = allDays.find((d) => d.date === date.toString());
      return Maybe.fromNullable(day);
    },
    {
      default: Nothing,
      dependencies: [date],
    },
  );
  const [day, _setDay] = useDay(date);

  const poops = useMemo(
    () => dayRep.map((d) => d.poops).orDefault([]),
    [dayRep],
  );
  const addPoop = useCallback(() => {
    const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
    const poopId = crypto.randomUUID();
    rep?.mutate.addPoop({
      id: repId,
      date: date.toString() as IsoDate,
      poopId,
      time: now(),
    });
  }, [dayRep, date, rep?.mutate]);

  const poopEls = useMemo(
    () =>
      poops.map((poop, idx) => {
        const toggleRun = (val: boolean) => {
          dayRep.ifJust((d) => {
            rep?.mutate.setPoop({
              id: d.id,
              date: d.date as IsoDate,
              poopId: poop.id,
              time: poop.time,
              onRun: val,
            });
          });
        };

        const changeTime = (timeOffsetMillis: number) => {
          dayRep.ifJust((d) => {
            const newtime: IsoDateTime = ZonedDateTime.of(
              date,
              LocalTime.ofSecondOfDay(Math.floor(timeOffsetMillis / 1000)),
              ZoneId.systemDefault(),
            ).format(DateTimeFormatter.ISO_ZONED_DATE_TIME) as IsoDateTime;
            rep?.mutate.setPoop({
              id: d.id,
              date: d.date as IsoDate,
              poopId: poop.id,
              time: newtime,
              onRun: poop.run != null,
            });
          });
        };

        const deleteSelf = () => {
          //day
          //  .map((d) => {
          //    return {
          //      ...d,
          //      poops: [...d.poops.slice(0, idx), ...d.poops.slice(idx + 1)],
          //    };
          //  })
          //  .ifJust((d) => {
          //    setDay(d);
          //  });
        };
        return (
          <ContextMenu.Root key={`${day}-${idx}`}>
            <ContextMenu.Trigger>
              <Card
                className={clsx(
                  poops.length === idx + 1 ? '' : 'mb-2',
                  'select-none',
                )}
              >
                <Flex align="center" gap="1" className="mb-4 select-none">
                  <div className="w-1/4">Time</div>
                  <div className="flex-1 text-right">
                    <TimePicker
                      time={poop.time as IsoDateTime}
                      onChange={changeTime}
                    />
                  </div>
                </Flex>
                <Flex align="center" className="select-none" gap="1">
                  <div className="w-1/4 select-none">On run</div>
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
            </ContextMenu.Trigger>
            <ContextMenu.Content size="1">
              <ContextMenu.Item onClick={deleteSelf}>Delete</ContextMenu.Item>
            </ContextMenu.Content>
          </ContextMenu.Root>
        );
      }),
    [poops, day, dayRep, rep, date],
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
