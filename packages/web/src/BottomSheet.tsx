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
import { Maybe } from 'purify-ts/Maybe';
import { useSubscribe } from 'replicache-react';

import SegmentedButton from './components/SegmentedButton';
import TimePicker from './components/TimePicker';
import { IsoDateTime } from './time';
import Pooper from './Pooper';
import { FrontendDay, useReplicache } from './replicache';
import { useCallback, useEffect, useMemo, useState } from 'react';

function BottomSheet({
  selectedDate,
  setSelectedDate,
  className,
}: {
  selectedDate: LocalDate | null;
  setSelectedDate: (date: LocalDate) => void;
  className?: string;
}) {
  const rep = useReplicache();
  if (selectedDate == null || rep == null) {
    return null;
  }
  return (
    <BottomSheetContents
      key={selectedDate.toString()}
      selectedDate={selectedDate}
      setSelectedDate={setSelectedDate}
      className={className}
    />
  );
}

const localDateToDisplay = (date: LocalDate): string => {
  const res = convert(date).toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return res;
};

const setCommentRep = (
  rep: ReturnType<typeof useReplicache>,
  selectedDate: LocalDate,
  dayRep: Maybe<FrontendDay>,
  comment: string,
): void => {
  const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
  const wakeUp = dayRep
    .chain((d) => Maybe.fromNullable(d.wakeUp?.time))
    .map<{ time: string } | null>((time) => ({
      time,
    }));
  rep?.mutate.setDay({
    date: selectedDate.toString(),
    id: repId,
    wakeUp: wakeUp.orDefault(null),
    dinner: {
      size: dayRep
        .chain(
          (d): Maybe<NonNullable<FrontendDay['dinner']>['size']> =>
            Maybe.fromNullable(d.dinner?.size),
        )
        .orDefault(null),
    },
    comment,
  });
};

const useSetCommentState = (
  rep: ReturnType<typeof useReplicache>,
  selectedDate: LocalDate,
  dayRep: Maybe<FrontendDay> | null,
): [string, (comment: string) => void] => {
  const comment =
    dayRep?.chain((d) => Maybe.fromNullable(d.comment)).orDefault('') ?? '';
  const setCommentState = useCallback(
    (comment: string) => {
      if (dayRep == null) {
        return;
      }
      setCommentRep(rep, selectedDate, dayRep, comment);
    },
    [rep, selectedDate, dayRep],
  );
  return [comment, setCommentState];
};

function BottomSheetContents({
  selectedDate,
  setSelectedDate,
  className,
}: {
  selectedDate: LocalDate;
  setSelectedDate: (date: LocalDate) => void;
  className?: string;
}) {
  const rep = useReplicache();

  const dayRep: Maybe<FrontendDay> | null = useSubscribe(
    rep,
    async (tx): Promise<Maybe<FrontendDay>> => {
      const allDays = (await tx
        .scan({
          prefix: `day/`,
        })
        .toArray()) as unknown as Array<FrontendDay>;
      const day = allDays.find((d) => d.date === selectedDate.toString());
      return Maybe.fromNullable(day);
    },
    {
      // HAX: For some reason `Nothing` is not assignable to
      // `Maybe<FrontendDay>`.
      default: null,
      dependencies: [selectedDate],
    },
  );

  const isToday = useMemo(() => {
    const now = LocalDate.now();
    return now.equals(selectedDate);
  }, [selectedDate]);

  const [comment, setComment] = useSetCommentState(rep, selectedDate, dayRep);

  useEffect(() => {
    console.log(
      JSON.stringify({
        dayRep,
      }),
    );
  }, [dayRep]);

  if (dayRep == null) {
    return null;
  }

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
    const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
    rep?.mutate.setDay({
      date: selectedDate.toString(),
      id: repId,
      wakeUp: {
        time,
      },
      dinner: {
        size: dayRep
          .chain(
            (d): Maybe<NonNullable<FrontendDay['dinner']>['size']> =>
              Maybe.fromNullable(d.dinner?.size),
          )
          .orDefault(null),
      },
      comment: dayRep
        .chain((d): Maybe<string | null> => Maybe.fromNullable(d.comment))
        .orDefault(null),
    });
  };

  const setWakeUpNow = () => {
    setWakeUp();
  };

  const setDinner = (size: 'regular' | 'big') => {
    const repId = dayRep.map((d) => d.id).orDefault(crypto.randomUUID());
    const wakeUp = dayRep
      .chain((d) => Maybe.fromNullable(d.wakeUp?.time))
      .map<{ time: string } | null>((time) => ({
        time,
      }));
    rep?.mutate.setDay({
      date: selectedDate.toString(),
      id: repId,
      wakeUp: wakeUp.orDefault(null),
      dinner: {
        size,
      },
      comment: dayRep
        .chain((d): Maybe<string | null> => Maybe.fromNullable(d.comment))
        .orDefault(null),
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
    {
      label: 'Notes',
      labelAlignStart: true,
      el: <NotesField cleanValue={comment} setNotes={setComment} />,
    },
  ];

  const goToToday = () => {
    setSelectedDate(LocalDate.now());
  };

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <h1 className={clsx('text-xl', 'font-bold')}>
          {localDateToDisplay(selectedDate)}
        </h1>
        {isToday ? null : (
          <Button variant="soft" size="1" onClick={goToToday}>
            &#x2934; Today
          </Button>
        )}
      </div>
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

function NotesField({
  cleanValue,
  setNotes,
}: {
  cleanValue: string;
  setNotes: (notes: string) => void;
}) {
  const [dirtyState, setDirtyState] = useState<{
    value: string;
    showingSave: boolean;
  } | null>(null);

  const buttons =
    dirtyState == null || !dirtyState.showingSave ? null : (
      <>
        <Button variant="solid" size="1" type="submit">
          Save
        </Button>
        <Button
          color="gray"
          variant="solid"
          size="1"
          onClick={() => {
            setDirtyState(null);
          }}
        >
          Cancel
        </Button>
      </>
    );

  return (
    <form
      className="flex flex-col gap-2 items-start"
      onSubmit={(e) => {
        e.preventDefault();
        if (dirtyState?.showingSave) {
          setNotes(dirtyState.value);
          setDirtyState(null);
        }
      }}
    >
      <textarea
        className="flex min-h-[60px] w-full rounded-3 border border-purple-3 bg-transparent px-3 py-3 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-purple-6 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
        placeholder="Notes"
        value={dirtyState == null ? cleanValue : dirtyState.value}
        onChange={(e) => {
          setDirtyState({
            showingSave: true,
            value: e.target.value,
          });
        }}
        onFocus={() => {
          setDirtyState((s) =>
            s != null
              ? s
              : {
                  value: cleanValue,
                  showingSave: true,
                },
          );
        }}
        onBlur={() => {
          if (dirtyState != null && dirtyState.value === cleanValue) {
            setDirtyState(null);
          }
        }}
      />
      <div className="flex gap-1">{buttons}</div>
    </form>
  );
}

export default BottomSheet;
