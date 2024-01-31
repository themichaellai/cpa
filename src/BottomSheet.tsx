import { LocalDate, convert } from '@js-joda/core';
import clsx from 'clsx';

function BottomSheet({ selectedDate }: { selectedDate: LocalDate | null }) {
  return <BottomSheetContents selectedDate={selectedDate} />;
}

const localDateToDisplay = (date: LocalDate): string => {
  const res = convert(date).toDate().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  return res;
};

function BottomSheetContents({
  selectedDate,
}: {
  selectedDate: LocalDate | null;
}) {
  if (selectedDate == null) {
    return null;
  }
  const controls: Array<{
    label: string;
    el: React.ReactNode;
  }> = [
    {
      label: 'Wake up',
      el: 'set',
    },
  ];
  return (
    <div className={clsx('mt-5', 'mx-5')}>
      <h1 className={clsx('text-xl')}>{localDateToDisplay(selectedDate)}</h1>
      {controls.map(({ label, el }) => (
        <div
          className={clsx(
            'flex',
            'px-5',
            'py-5',
            'border',
            `border-purple9`,
            'rounded-lg',
          )}
        >
          <div className="w-1/4">{label}</div>
          <div className="flex-1">{el}</div>
        </div>
      ))}
    </div>
  );
}

export default BottomSheet;
