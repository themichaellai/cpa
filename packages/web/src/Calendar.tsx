import { convert, LocalDate, nativeJs } from '@js-joda/core';
import { Button } from '@radix-ui/themes';
import Cal from 'react-calendar';

import ChevronButton from './components/ChevronButton';
import { isPoopless, useDays } from './store/days';

const toLocalDate = (d: Date) => LocalDate.from(nativeJs(d));
const toJsDate = (d: LocalDate) => convert(d).toDate();

function Calendar({
  value,
  onChange,
  today,
  activeStartDate,
  onActiveStartDateChange,
}: {
  value: LocalDate;
  onChange: (d: LocalDate) => void;
  today: LocalDate;
  activeStartDate: LocalDate;
  onActiveStartDateChange: (d: LocalDate) => void;
}) {
  const days = useDays();
  const thisMonth = today.withDayOfMonth(1);
  const showToday = !value.equals(today) || !activeStartDate.equals(thisMonth);

  const monthLabel = toJsDate(activeStartDate).toLocaleDateString('en-US', {
    month: 'long',
    ...(activeStartDate.year() === today.year() ? {} : { year: 'numeric' }),
  });

  return (
    <div className="calendar">
      <div className="flex items-center pl-2">
        <h2 className="flex-1 text-[18px] font-bold">{monthLabel}</h2>
        {showToday ? (
          <Button variant="soft" size="1" onClick={() => onChange(today)}>
            Today
          </Button>
        ) : null}
        <ChevronButton
          direction="left"
          label="Previous month"
          onClick={() =>
            onActiveStartDateChange(activeStartDate.minusMonths(1))
          }
        />
        <ChevronButton
          direction="right"
          label="Next month"
          disabled={!activeStartDate.isBefore(thisMonth)}
          onClick={() => onActiveStartDateChange(activeStartDate.plusMonths(1))}
          className="-mr-1"
        />
      </div>
      <Cal
        calendarType="iso8601"
        minDetail="month"
        showNavigation={false}
        showNeighboringMonth={false}
        maxDate={toJsDate(today)}
        activeStartDate={toJsDate(activeStartDate)}
        onActiveStartDateChange={({ activeStartDate }) => {
          if (activeStartDate != null) {
            onActiveStartDateChange(toLocalDate(activeStartDate));
          }
        }}
        onChange={(date) => onChange(toLocalDate(date as Date))}
        value={toJsDate(value)}
        tileClassName={({ date }) => {
          const d = toLocalDate(date);
          return [
            d.equals(value) ? 'is-selected' : null,
            d.equals(today) ? 'is-today' : null,
          ].filter((c) => c != null);
        }}
        tileContent={({ date }) => {
          const d = toLocalDate(date);
          return d.isBefore(today) && isPoopless(days.get(d.toString())) ? (
            <span className="calendar-marker" aria-label="No poops" />
          ) : null;
        }}
      />
    </div>
  );
}

export default Calendar;
