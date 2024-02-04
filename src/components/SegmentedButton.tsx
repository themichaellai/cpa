import clsx from 'clsx';

interface Option<T> {
  label: string;
  value: T;
}
const SegmentedButton = <T,>({
  selected,
  options,
  onSelect,
}: {
  selected: T | null;
  options: Array<Option<T>>;
  onSelect: (option: T) => void;
}) => {
  return (
    <div className="border border-purple-6 rounded-4">
      {options.map((opt) => (
        <button
          key={opt.label}
          className={clsx([
            'm-1',
            'py-1',
            'px-3',
            ...(selected === opt.value
              ? ['border', 'border-purple-6', 'bg-purple-5']
              : ['border', 'border-transparent']),
            'rounded-3',
          ])}
          onClick={() => {
            onSelect(opt.value);
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
};

export default SegmentedButton;
