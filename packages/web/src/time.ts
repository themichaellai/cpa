// Zoned date-times are handled by hand with the native Date (device offset)
// and Intl (device IANA zone name). @js-joda/core is still used for LocalDate,
// which works without @js-joda/timezone: LocalDate.now(), convert() and
// nativeJs() fall back to ZoneId.SYSTEM, i.e. the native Date.
//
// Do NOT use ZonedDateTime, ZoneId, LocalTime or DateTimeFormatter from
// @js-joda/core here or elsewhere: without the timezone plugin they serialize
// the zone as `[SYSTEM]`, which the server's time.LoadLocation rejects.
import { LocalDate } from '@js-joda/core';
import { useEffect, useRef, useState } from 'react';
import { Either, Left, Right } from 'purify-ts/Either';

/** `YYYY-MM-DD` (LocalDate.toString()). */
export type IsoDate = string & { __type: 'isoDate' };
/**
 * RFC3339 date-time with seconds followed by the IANA zone in brackets, e.g.
 * `2026-10-31T21:18:55-04:00[America/New_York]` or `...Z[UTC]`. The server
 * stores the wall-clock fields plus the zone name and ignores the offset.
 */
export type IsoDateTime = string & { __type: 'isoDateTime' };

const p2 = (n: number): string => String(n).padStart(2, '0');
const p4 = (n: number): string => String(n).padStart(4, '0');

/**
 * Builds a Date in the device zone from wall-clock fields. Uses setFullYear so
 * years below 100 are not mapped into the 1900s. Wall-clock times inside a DST
 * gap move forward by the gap length (02:30 -> 03:30); in a DST overlap the
 * earlier (pre-transition) offset is used. Both match js-joda's
 * ZonedDateTime.of.
 */
const localDateTime = (
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
): Date => {
  const d = new Date(2000, 0, 1);
  d.setFullYear(year, month - 1, day);
  d.setHours(hour, minute, second, 0);
  return d;
};

const deviceZone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
};

const formatOffset = (dt: Date): string => {
  const offsetMinutes = -dt.getTimezoneOffset();
  if (offsetMinutes === 0) {
    return 'Z';
  }
  const abs = Math.abs(offsetMinutes);
  const sign = offsetMinutes < 0 ? '-' : '+';
  return `${sign}${p2(Math.floor(abs / 60))}:${p2(abs % 60)}`;
};

/** Formats an instant in the device zone. Always includes seconds, never fractions. */
export const formatZoned = (dt: Date): IsoDateTime => {
  const [y, mo, d] = [dt.getFullYear(), dt.getMonth() + 1, dt.getDate()];
  const [h, mi, se] = [dt.getHours(), dt.getMinutes(), dt.getSeconds()];
  const date = `${p4(y)}-${p2(mo)}-${p2(d)}`;
  const time = `${p2(h)}:${p2(mi)}:${p2(se)}`;
  return `${date}T${time}${formatOffset(dt)}[${deviceZone()}]` as IsoDateTime;
};

export const now = (): IsoDateTime => formatZoned(new Date());

/**
 * `date` at `secondOfDay` seconds after midnight, in the device zone.
 * Returns null for NaN (e.g. a cleared time input), negative values, or values
 * of 86400 or more; callers should then skip the mutation.
 */
export const zonedAt = (
  date: LocalDate,
  secondOfDay: number,
): IsoDateTime | null => {
  if (
    !Number.isFinite(secondOfDay) ||
    secondOfDay < 0 ||
    secondOfDay >= 86400
  ) {
    return null;
  }
  const s = Math.floor(secondOfDay);
  return formatZoned(
    localDateTime(
      date.year(),
      date.monthValue(),
      date.dayOfMonth(),
      Math.floor(s / 3600),
      Math.floor(s / 60) % 60,
      s % 60,
    ),
  );
};

/** `date` at the device's current wall-clock time (seconds precision). */
export const zonedNowOn = (date: LocalDate): IsoDateTime => {
  const n = new Date();
  // secondOfDay is always in [0, 86400) here, so this never returns null.
  return zonedAt(
    date,
    n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds(),
  ) as IsoDateTime;
};

const ZONED_RE =
  /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d)(?::(\d\d)(?:\.\d{1,9})?)?(?:Z|[+-]\d\d:\d\d)\[([^\]]+)\]$/;

const isLeapYear = (y: number): boolean =>
  (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

const daysInMonth = (y: number, m: number): number =>
  m === 2 ? (isLeapYear(y) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;

const isKnownZone = (zone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
};

/**
 * Parses an IsoDateTime and returns a Date in the device zone with the
 * string's WALL-CLOCK fields; the offset is deliberately ignored, as on the
 * server (equivalent to js-joda's withZoneSameLocal(ZoneId.SYSTEM)). So
 * `10:00-03:00[America/Asuncion]` is 10:00 local on any device.
 * Left on malformed input, out-of-range fields or an unknown zone.
 */
export const parseDateTime = (isoDateTime: string): Either<Error, Date> => {
  const m = ZONED_RE.exec(isoDateTime);
  if (m == null) {
    return Left(new Error(`Invalid date-time: ${isoDateTime}`));
  }
  const [year, month, day, hour, minute, second] = m
    .slice(1, 7)
    .map((v) => (v == null ? 0 : Number(v)));
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour > 23 ||
    minute > 59 ||
    second > 59
  ) {
    return Left(new Error(`Invalid date-time: ${isoDateTime}`));
  }
  if (!isKnownZone(m[7])) {
    return Left(new Error(`Unknown time zone: ${m[7]}`));
  }
  return Right(localDateTime(year, month, day, hour, minute, second));
};

export const formatTimeForDisplay = (dt: IsoDateTime): Either<Error, string> =>
  parseDateTime(dt).map((d) =>
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  );

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
