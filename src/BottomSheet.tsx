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

import SegmentedButton from './components/SegmentedButton';
import TimePicker from './components/TimePicker';
import { useDay } from './store';
import { IsoDateTime, now } from './time';

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

  const setWakeUp = (timeOffsetMillis?: number) => {
    const time: IsoDateTime =
      timeOffsetMillis == null
        ? now()
        : (ZonedDateTime.of(
            LocalDate.now(),
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
  }> = [
    {
      label: 'Wake up',
      el: day
        .chain((d) => Maybe.fromNullable(d.wakeUp?.time))
        .map((wakeUp) => <TimePicker time={wakeUp} onChange={setWakeUp} />)
        .orDefault(
          <Button variant="classic" onClick={setWakeUpNow}>
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
  ];

  return (
    <div className={clsx('mt-5', 'mx-5')}>
      <h1 className={clsx('text-xl')}>{localDateToDisplay(selectedDate)}</h1>
      {controls.map(({ label, el }) => (
        <Card key={label} className={clsx('mt-5')}>
          <Flex align="center">
            <div className="w-1/4">{label}</div>
            <div className="flex-1">{el}</div>
          </Flex>
        </Card>
      ))}
    </div>
  );
}

export default BottomSheet;
