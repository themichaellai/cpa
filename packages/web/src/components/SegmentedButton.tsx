import clsx from 'clsx';
import { useLayoutEffect, useRef, useState } from 'react';

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
  const buttonRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [indicator, setIndicator] = useState<{
    left: number;
    width: number;
  } | null>(null);

  const selectedIndex = options.findIndex((opt) => opt.value === selected);

  useLayoutEffect(() => {
    if (selectedIndex < 0) {
      setIndicator(null);
      return;
    }
    const el = buttonRefs.current[selectedIndex];
    if (!el) return;
    setIndicator({ left: el.offsetLeft, width: el.offsetWidth });
  }, [selectedIndex, options.length]);

  return (
    <div className="relative inline-flex gap-1 rounded-4 p-1 shadow-[inset_0_0_0_1px_var(--gray-a5)]">
      {indicator && (
        <div
          aria-hidden
          className="absolute top-1 bottom-1 rounded-2 bg-purple-3 shadow-[inset_0_0_0_0.5px_var(--gray-a5)] transition-[left,width] duration-200 ease-[cubic-bezier(0.645,0.045,0.355,1)] motion-reduce:transition-none"
          style={{
            width: `${indicator.width}px`,
            left: `${indicator.left}px`,
          }}
        />
      )}
      {options.map((opt, i) => (
        <button
          key={opt.label}
          ref={(el) => {
            buttonRefs.current[i] = el;
          }}
          type="button"
          className={clsx(
            'relative rounded-2 px-3 py-1 text-[14px] leading-[20px] font-medium cursor-pointer transition-colors duration-200 motion-reduce:transition-none',
            selected === opt.value
              ? 'text-purple-11'
              : 'text-gray-11 [@media(hover:hover)]:hover:bg-gray-3',
          )}
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
