import { useMemo, useRef } from 'react';
import { Button } from '@radix-ui/themes';
import { Either } from 'purify-ts/Either';
import { convert } from '@js-joda/core';

import { IsoDateTime, parseDateTime } from '../time';

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

const formatTime = (dt: IsoDateTime): Either<Error, string> => {
  const parsed = parseDateTime(dt);
  return parsed.map((dateTime) => {
    return convert(dateTime).toDate().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  });
};

const TimePicker = ({
  time,
  onChange,
}: {
  time: IsoDateTime;
  onChange: (timeOffsetMillis: number) => void;
}) => {
  const formattedTime = useMemo(
    () => formatTime(time).orDefault('Set'),
    [time],
  );
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
        className="bg-purple-3 border-purple-4 border"
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
        {formattedTime}
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

export default TimePicker;
