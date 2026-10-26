import clsx from 'clsx';

const ChevronButton = ({
  direction,
  label,
  disabled,
  onClick,
  className,
}: {
  direction: 'left' | 'right';
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}) => (
  <button
    type="button"
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
    className={clsx(
      'grid size-11 place-items-center rounded-full text-gray-12',
      'hover:bg-gray-a3 disabled:text-gray-8 disabled:hover:bg-transparent',
      'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-8)]',
      className,
    )}
  >
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
      <path
        d={direction === 'left' ? 'M10 3L5 8l5 5' : 'M6 3l5 5-5 5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
);

export default ChevronButton;
