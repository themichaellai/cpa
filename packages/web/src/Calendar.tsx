import { convert, LocalDate, nativeJs } from '@js-joda/core';
import Cal from 'react-calendar';
import { useMemo } from 'react';

import styles from './Calendar.module.css';

function Calendar({
  value,
  onChange,
  activeStartDate,
  ...props
}: {
  value: LocalDate;
  onChange: (d: LocalDate) => void;
  activeStartDate: LocalDate | null;
  onActiveStartDateChange: (d: LocalDate | null) => void;
}) {
  const jsDate = useMemo(() => convert(value).toDate(), [value]);
  const onActiveStartDateChange = ({
    activeStartDate,
  }: {
    activeStartDate: Date | null;
  }) => {
    const localDate = LocalDate.from(nativeJs(activeStartDate));
    props.onActiveStartDateChange(localDate);
  };
  return (
    <Cal
      activeStartDate={
        activeStartDate == null ? undefined : convert(activeStartDate).toDate()
      }
      onActiveStartDateChange={onActiveStartDateChange}
      onChange={(date) => {
        const localDate = LocalDate.from(nativeJs(date));
        onChange(localDate);
      }}
      value={jsDate}
      className={styles.calendar}
      tileClassName={({ date }) => {
        return [
          ...(jsDate.getTime() === date.getTime()
            ? ['font-bold', styles.tileSelected]
            : [styles.tileUnselected, 'font-medium']),
          'py-2',
          'text-xs',
        ];
      }}
    />
  );
}

export default Calendar;
