import { convert, LocalDate, nativeJs } from '@js-joda/core';
import Cal from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { useMemo } from 'react';

import './Calendar.css';

function Calendar({
  value,
  onChange,
}: {
  value: LocalDate;
  onChange: (d: LocalDate) => void;
}) {
  const jsDate = useMemo(() => convert(value).toDate(), [value]);
  return (
    <Cal
      onChange={(date) => {
        const localDate = LocalDate.from(nativeJs(date));
        onChange(localDate);
      }}
      value={jsDate}
      className="calendar"
    />
  );
}

export default Calendar;
