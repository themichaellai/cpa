import '@js-joda/timezone';
import { ZonedDateTime, convert, LocalDate, ZoneId } from '@js-joda/core';
import { useEffect, useRef, useState } from 'react';
import { Either } from 'purify-ts/Either';

export type IsoDateTime = string & { __type: 'isoDateTime' };
export type IsoDate = string & { __type: 'isoDate' };

export const now = (): IsoDateTime => {
  return ZonedDateTime.now().toString() as IsoDateTime;
};

export const parseDateTime = (
  isoDateTime: string,
): Either<Error, ZonedDateTime> => {
  return Either.encase(() => ZonedDateTime.parse(isoDateTime));
};

export const formatTimeForDisplay = (
  dt: IsoDateTime,
): Either<Error, string> => {
  const parsed = parseDateTime(dt).map((dt) =>
    dt.withZoneSameLocal(ZoneId.SYSTEM),
  );
  return parsed.map((dateTime) => {
    return convert(dateTime).toDate().toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    });
  });
};

function msUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

export function useCurrentDate(): LocalDate {
  const [currentDate, setCurrentDate] = useState(() => LocalDate.now());
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const check = () => {
      const now = LocalDate.now();
      setCurrentDate((prev) => (prev.equals(now) ? prev : now));
    };

    const scheduleMidnight = () => {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        check();
        scheduleMidnight();
      }, msUntilMidnight() + 100); // small buffer past midnight
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        check();
        scheduleMidnight();
      }
    };

    scheduleMidnight();
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      clearTimeout(timeoutRef.current);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, []);

  return currentDate;
}
