import { useMemo, useRef } from 'react';
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

import { useDay } from './store';
import { IsoDateTime, now, parseDateTime } from './time';
import { Either } from 'purify-ts/Either';

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

const formatTime = (dt: IsoDateTime): Either<Error, string> => {
  const parsed = parseDateTime(dt);
  return parsed.map((dateTime) => {
    return convert(dateTime).toDate().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  });
};

const formatTimeForInput = (dt: IsoDateTime): Either<Error, string> => {
  const parsed = parseDateTime(dt);
  // format as 24 hour time
  return parsed.map((dateTime) => {
    return convert(dateTime).toDate().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  });
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

const TimePicker = ({
  time,
  onChange,
}: {
  time: IsoDateTime;
  onChange: (timeOffsetMillis: number) => void;
}) => {
  const wakeUp = useMemo(() => formatTime(time).orDefault('Set'), [time]);
  const formFormattedTime = useMemo(
    () => formatTimeForInput(time).orDefault('00:00'),
    [time],
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const userAgent = window.navigator.userAgent;
  const isIos = !!userAgent.match(/iPad/i) || !!userAgent.match(/iPhone/i);
  const isWebkit = !!userAgent.match(/WebKit/i);
  const isIosSafari = isIos && isWebkit && !userAgent.match(/CriOS/i);

  const onTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.valueAsNumber);
  };

  if (isIosSafari) {
    return (
      <input
        type="time"
        className="bg-purple10"
        ref={inputRef}
        value={formFormattedTime}
        onInput={onTimeInputChange}
      />
    );
  }

  return (
    <div className="relative">
      <Button
        variant="soft"
        onClick={() => {
          inputRef.current?.showPicker();
        }}
      >
        {wakeUp}
      </Button>
      <input
        type="time"
        className="absolute bg-transparent"
        ref={inputRef}
        value={formFormattedTime}
        onChange={onTimeInputChange}
      />
    </div>
  );
};

export default BottomSheet;
