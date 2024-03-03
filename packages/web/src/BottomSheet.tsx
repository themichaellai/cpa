import {
  LocalDate,
  LocalTime,
  ZoneId,
  ZonedDateTime,
  convert,
} from '@js-joda/core';
import clsx from 'clsx';
import { Button, Card, Flex } from '@radix-ui/themes';
import { Maybe } from 'purify-ts/Maybe';
import { useSubscribe } from 'replicache-react';

import { FrontendDay } from '../convex/days';
import SegmentedButton from './components/SegmentedButton';
import TimePicker from './components/TimePicker';
import { useDay } from './store';
import { IsoDateTime } from './time';
import Pooper from './Pooper';
import { useReplicache } from './replicache';
import { useEffect, useMemo } from 'react';

function BottomSheet({ selectedDate }: { selectedDate: LocalDate | null }) {
  if (selectedDate == null) {
    return null;
  }
  return <BottomSheetContents selectedDate={selectedDate} />;
}

const localDateToDisplay = (date: LocalDate): string => {
  const res = convert(date).toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return res;
};

function BottomSheetContents({ selectedDate }: { selectedDate: LocalDate }) {
  const [day, setDay] = useDay(selectedDate);
  const rep = useReplicache();
  const repIdWithDay = useSubscribe(
    rep,
    async (tx) => {
      const res = tx.scan({
        prefix: `day/`,
      });
      return (await res.toArray()) as Array<FrontendDay>;
    },
    {
      default: null,
    },
  );
  const dateToId = useMemo(() => {
    if (repIdWithDay == null) {
      return null;
    }
    return Object.fromEntries(
      repIdWithDay.map((day) => [day.date, day.id] as const),
    );
  }, [repIdWithDay]);
  useEffect(() => {
    console.log({
      repIdWithDay: repIdWithDay ?? null,
      dateToId: dateToId ?? null,
    });
  }, [repIdWithDay, dateToId]);

  const repDay = useSubscribe(
    rep,
    async (tx) => {
      const res = await tx.get(`day/${dateToId?.[selectedDate.toString()]}`);
      return res as FrontendDay;
    },
    {
      default: null,
      dependencies: [dateToId, selectedDate],
    },
  );

  useEffect(() => {
    console.log(
      JSON.stringify({
        repDay: repDay ?? null,
      }),
    );
  }, [repDay]);
  const setWakeUp = (timeOffsetMillis?: number) => {
    const time: IsoDateTime =
      timeOffsetMillis == null
        ? (ZonedDateTime.of(
            selectedDate,
            LocalTime.now(),
            ZoneId.systemDefault(),
          ).toString() as IsoDateTime)
        : (ZonedDateTime.of(
            selectedDate,
            LocalTime.ofSecondOfDay(Math.floor(timeOffsetMillis / 1000)),
            ZoneId.systemDefault(),
          ).toString() as IsoDateTime);
    day.ifJust((d) => {
      setDay({
        ...d,
        wakeUp: {
          time,
        },
      });
      const repId = dateToId?.[d.date] ?? crypto.randomUUID();
      rep?.mutate.setWakeUp({
        date: selectedDate.toString(),
        id: repId,
        wakeUp: {
          time,
        },
      });
    });
  };

  const setWakeUpNow = () => {
    setWakeUp();
  };

  const setDinner = (size: 'regular' | 'big') => {
    day.ifJust((d) => {
      setDay({
        ...d,
        dinner: {
          size,
          time: null,
        },
      });
    });
  };

  const controls: Array<{
    label: string;
    el: React.ReactNode;
    labelAlignStart?: boolean;
  }> = [
    {
      label: 'Wake up',
      el: day
        .chain((d) => Maybe.fromNullable(d.wakeUp?.time))
        .map((wakeUp) => <TimePicker time={wakeUp} onChange={setWakeUp} />)
        .orDefault(
          <Button variant="soft" onClick={setWakeUpNow}>
            Set
          </Button>,
        ),
    },
    {
      label: 'Dinner',
      el: (
        <div className="flex justify-start">
          <SegmentedButton
            selected={day
              .chain((d) => Maybe.fromNullable(d.dinner?.size))
              .extractNullable()}
            options={[
              { label: 'Regular', value: 'regular' },
              { label: 'Big', value: 'big' },
            ]}
            onSelect={setDinner}
          />
        </div>
      ),
    },
    {
      label: 'Poops',
      labelAlignStart: true,
      el: <Pooper date={selectedDate} />,
    },
  ];

  return (
    <div className={clsx('my-5', 'mx-5')}>
      <h1 className={clsx('text-xl')}>{localDateToDisplay(selectedDate)}</h1>
      {controls.map(({ label, labelAlignStart, el }) => (
        <Card key={label} className={clsx('mt-5')}>
          <Flex align={labelAlignStart ? 'start' : 'center'}>
            <div className={clsx(['w-1/4', labelAlignStart ? 'my-3' : null])}>
              {label}
            </div>
            <div className="flex-1">{el}</div>
          </Flex>
        </Card>
      ))}
    </div>
  );
}

export default BottomSheet;
