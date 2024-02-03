import { LocalDate, convert } from '@js-joda/core';
import clsx from 'clsx';
import { Button, Card, Flex } from '@radix-ui/themes';

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
      el: <Button variant="classic">Set</Button>,
    },
  ];
  return (
    <div className={clsx('mt-5', 'mx-5')}>
      <h1 className={clsx('text-xl')}>{localDateToDisplay(selectedDate)}</h1>
      {controls.map(({ label, el }) => (
        <Card className={clsx('mt-5')}>
          <Flex align="center">
            <div className="w-1/4">{label}</div>
            <div className="flex-1">{el}</div>
          </Flex>
        </Card>
      ))}
    </div>
  );
}

export default BottomSheet;
