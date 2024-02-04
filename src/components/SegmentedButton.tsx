import clsx from 'clsx';
import { Button, Flex } from '@radix-ui/themes';

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
    <Flex gap="1" className="border border-purple-6 rounded-4 p-1">
      {options.map((opt) => (
        <Button
          key={opt.label}
          variant="ghost"
          color={selected === opt.value ? 'purple' : 'gray'}
          className={clsx([
            'm-1',
            'py-1',
            'px-3',
            ...(selected === opt.value
              ? ['border', 'border-purple-6', 'bg-purple-3']
              : ['border', 'border-transparent']),
            'rounded-3',
          ])}
          onClick={() => {
            onSelect(opt.value);
          }}
        >
          {opt.label}
        </Button>
      ))}
    </Flex>
  );
};

export default SegmentedButton;
