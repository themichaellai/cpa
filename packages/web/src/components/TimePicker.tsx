import { useMemo, useRef } from 'react';
import { Button } from '@radix-ui/themes';
import { Either } from 'purify-ts/Either';
import { convert, ZoneId } from '@js-joda/core';
import { formatTimeForDisplay, IsoDateTime, parseDateTime } from '../time';
import { isIosSafari } from '../utils/device';

const formatTimeForInput = (dt: IsoDateTime): Either<Error, string> => {
  const parsed = parseDateTime(dt).map((dt) =>
    dt.withZoneSameLocal(ZoneId.SYSTEM),
  );
  // format as 24 hour time
  return parsed.map((dateTime) => {
    return convert(dateTime).toDate().toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
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
    () => formatTimeForDisplay(time).orDefault('Set'),
    [time],
  );
  const formFormattedTime = useMemo(
    () => formatTimeForInput(time).orDefault('00:00'),
    [time],
  );
  const inputRef = useRef<HTMLInputElement>(null);

  const onTimeInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.valueAsNumber);
  };

  if (isIosSafari()) {
    return (
      <input
        type="time"
        className="bg-purple-3 whitespace-nowrap text-purple-10 rounded-2 px-2"
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
        className="absolute opacity-0 w-0 h-0 overflow-hidden"
        ref={inputRef}
        value={formFormattedTime}
        onChange={onTimeInputChange}
      />
    </div>
  );
};

export default TimePicker;
