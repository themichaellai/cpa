import '@js-joda/timezone';
import { ZonedDateTime, convert, ZoneId } from '@js-joda/core';
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
