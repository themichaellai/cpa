import { LocalDate, nativeJs } from '@js-joda/core';
import Cal from 'react-calendar';
import 'react-calendar/dist/Calendar.css';

import './Calendar.css';

function Calendar({ onChange }: { onChange: (d: LocalDate) => void }) {
  return (
    <Cal
      onChange={(date) => {
        const localDate = LocalDate.from(nativeJs(date));
        onChange(localDate);
      }}
      className="calendar"
    />
  );
}

export default Calendar;
