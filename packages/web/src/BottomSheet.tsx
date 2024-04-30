import {
  convert,
  DateTimeFormatter,
  LocalDate,
  LocalTime,
  ZonedDateTime,
  ZoneId,
} from '@js-joda/core';
import clsx from 'clsx';
import { Button, Card, Flex } from '@radix-ui/themes';
import { Maybe, Nothing } from 'purify-ts/Maybe';
import { useSubscribe } from 'replicache-react';

import { FrontendDay } from '../convex/days';
import SegmentedButton from './components/SegmentedButton';
import TimePicker from './components/TimePicker';
import { useDay } from './store';
import { IsoDateTime } from './time';
import Pooper from './Pooper';
import { useReplicache } from './replicache';
import { useEffect } from 'react';

function BottomSheet({ selectedDate }: { selectedDate: LocalDate | null }) {
  const rep = useReplicache();
  if (selectedDate == null || rep == null) {
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
  const [dayJotai, setDayJotai] = useDay(selectedDate);
  const rep = useReplicache();

  const dayRep = useSubscribe(
    rep,
    async (tx): Promise<Maybe<FrontendDay>> => {
      const allDays = (await tx
        .scan({
          prefix: `day/`,
        })
        .toArray()) as Array<FrontendDay>;
      const day = allDays.find((d) => d.date === selectedDate.toString());
      return Maybe.fromNullable(day);
    },
    {
      default: Nothing,
      dependencies: [selectedDate],
    },
  );

  useEffect(() => {
    console.log(
      JSON.stringify({
        dayRep,
      }),
    );
  }, [dayRep]);
  const setWakeUp = (timeOffsetMillis?: number) => {
    const time: IsoDateTime =
      timeOffsetMillis == null
        ? (ZonedDateTime.of(
            selectedDate,
            LocalTime.now(),
            ZoneId.systemDefault(),
          ).format(DateTimeFormatter.ISO_ZONED_DATE_TIME) as IsoDateTime)
        : (ZonedDateTime.of(
            selectedDate,
            LocalTime.ofSecondOfDay(Math.floor(timeOffsetMillis / 1000)),
            ZoneId.systemDefault(),
          ).format(DateTimeFormatter.ISO_ZONED_DATE_TIME) as IsoDateTime);
    dayJotai.ifJust((d) => {
      setDayJotai({
        ...d,
        wakeUp: {
          time,
        },
      });
      const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
      rep?.mutate.setDay({
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
    dayJotai.ifJust((d) => {
      setDayJotai({
        ...d,
        dinner: {
          size,
          time: null,
        },
      });
    });
    const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
    rep?.mutate.setDinner({
      date: selectedDate.toString(),
      id: repId,
      size,
    });
  };

  const controls: Array<{
    label: string;
    el: React.ReactNode;
    labelAlignStart?: boolean;
  }> = [
    {
      label: 'Wake up',
      el: dayRep
        .chain((d) => Maybe.fromNullable(d.wakeUp?.time))
        .map((wakeUp) => (
          <TimePicker time={wakeUp as IsoDateTime} onChange={setWakeUp} />
        ))
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
            selected={dayRep
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
