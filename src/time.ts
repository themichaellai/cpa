import '@js-joda/timezone';
import { ZonedDateTime } from '@js-joda/core';
import { Either } from 'purify-ts/Either';

export type IsoDateTime = string & { __type: 'isoDateTime' };
export type IsoDate = string & { __type: 'isoDate' };

export const now = (): IsoDateTime => {
  return ZonedDateTime.now().toString() as IsoDateTime;
};

export const parseDateTime = (
  isoDateTime: IsoDateTime,
): Either<Error, ZonedDateTime> => {
  return Either.encase(() => ZonedDateTime.parse(isoDateTime));
};
