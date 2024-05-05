import { useCallback, useMemo } from 'react';
import { LocalDate } from '@js-joda/core';
import { Button, Card, ContextMenu, Flex, Switch } from '@radix-ui/themes';
import clsx from 'clsx';
import { useSubscribe } from 'replicache-react';
import { Maybe, Nothing } from 'purify-ts/Maybe';

import { FrontendDay } from '../convex/days';
import { useDay } from './store';
import { IsoDate, IsoDateTime, now } from './time';
import { useReplicache } from './replicache';
import TimePicker from './components/TimePicker';

//const setPoopAtIdx = (poops: Poop[], idx: number, newPoop: Poop): Poop[] => [
//  ...poops.slice(0, idx),
//  newPoop,
//  ...poops.slice(idx + 1),
//];

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
      //return Maybe.fromNullable(day)
      //  .toEither(null)
      //  .chain((day) => {
      //    if (day.wakeUp == null) {
      //      return Right(day);
      //    }
      //    return parseDateTime(day.wakeUp.time).map((t) => ({
      //      ...day,
      //      wakeUp: {
      //        ...day.wakeUp,
      //        time: t,
      //      },
      //    }));
      //  })
      //  .toMaybe();
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
    rep?.mutate.addPoop({
      id: repId,
      date: date.toString() as IsoDate,
      time: now(),
    });
  }, [dayRep, date, rep?.mutate]);

  const poopEls = useMemo(
    () =>
      poops.map((poop, idx) => {
        const toggleRun = (_val: boolean) => {
          //day
          //  .map((d): Day => {
          //    const newPoop: Poop = {
          //      ...poop,
          //      run: !val
          //        ? null
          //        : {
          //            timeIntoRunMinutes: 0,
          //          },
          //    };
          //    return {
          //      ...d,
          //      poops: setPoopAtIdx(d.poops, idx, newPoop),
          //    };
          //  })
          //  .ifJust((d) => {
          //    setDay(d);
          //  });
        };

        const changeTime = (_timeOffsetMillis: number) => {
          //day
          //  .map((d) => {
          //    const newTime: IsoDateTime = ZonedDateTime.of(
          //      date,
          //      LocalTime.ofSecondOfDay(Math.floor(timeOffsetMillis / 1000)),
          //      ZoneId.systemDefault(),
          //    ).toString() as IsoDateTime;
          //    return {
          //      ...d,
          //      poops: setPoopAtIdx(d.poops, idx, {
          //        ...poop,
          //        time: newTime,
          //      }),
          //    };
          //  })
          //  .ifJust((d) => {
          //    setDay(d);
          //  });
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
    [poops, day],
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
