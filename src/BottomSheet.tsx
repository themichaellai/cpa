import { LocalDate } from '@js-joda/core';

function BottomSheet({ selectedDate }: { selectedDate: LocalDate | null }) {
  return <BottomSheetContents selectedDate={selectedDate} />;
}

function BottomSheetContents({
  selectedDate,
}: {
  selectedDate: LocalDate | null;
}) {
  if (selectedDate == null) {
    return null;
  }
  return (
    <div>
      <h1>{selectedDate.toString()}</h1>
    </div>
  );
}

export default BottomSheet;
