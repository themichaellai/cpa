import { useEffect, useRef, useState } from 'react';
import { Popover, Text } from '@radix-ui/themes';
import clsx from 'clsx';

import { useSyncStatus, type SyncStatus } from '../replicache';

type Kind = 'pending' | 'offline' | 'recovered';

// A normal push finishes in a few hundred ms; don't show anything for those.
const SHOW_DELAY_MS = 1000;
// Once shown, stay up at least this long so it never flashes on and off.
const MIN_VISIBLE_MS = 800;
// After coming back online, briefly confirm everything synced.
const RECOVERED_MS = 1500;

const useIndicatorState = (status: SyncStatus) => {
  const [visible, setVisible] = useState(false);
  // Keep the last kind while fading out so the dot doesn't change colour.
  const [kind, setKind] = useState<Kind>('pending');
  const shownAt = useRef(0);
  const wasOffline = useRef(false);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = (k: Kind) => {
      if (!visible) shownAt.current = Date.now();
      setKind(k);
      setVisible(true);
    };

    if (status === 'offline') {
      wasOffline.current = true;
      show('offline');
    } else if (status === 'pending') {
      if (visible) show('pending');
      else timer = setTimeout(() => show('pending'), SHOW_DELAY_MS);
    } else if (wasOffline.current) {
      wasOffline.current = false;
      show('recovered');
    } else if (visible) {
      const hold =
        kind === 'recovered'
          ? RECOVERED_MS
          : MIN_VISIBLE_MS - (Date.now() - shownAt.current);
      timer = setTimeout(() => setVisible(false), Math.max(0, hold));
    }
    return () => clearTimeout(timer);
  }, [status, visible, kind]);

  return { visible, kind };
};

const plural = (n: number) => `${n} change${n === 1 ? '' : 's'}`;

const COPY: Record<Kind, (n: number) => { label: string; detail: string }> = {
  pending: (n) => ({
    label: `${plural(n)} waiting to sync`,
    detail: 'Saved on this device. Sending to the server…',
  }),
  offline: (n) => ({
    label: `Offline. ${plural(n)} saved on this device`,
    detail:
      "Can't reach the server. Your changes are safe and will sync when you're back online.",
  }),
  recovered: () => ({
    label: 'All changes synced',
    detail: 'Everything is saved.',
  }),
};

const DOT: Record<Kind, string> = {
  pending: 'bg-[var(--gray-9)]',
  offline: 'bg-[var(--amber-9)]',
  recovered: 'bg-[var(--grass-9)]',
};

const EASE_OUT = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

const SyncIndicator: React.FC = () => {
  const { status, pendingCount } = useSyncStatus();
  const { visible, kind } = useIndicatorState(status);
  const { label, detail } = COPY[kind](pendingCount);
  // Announce offline / recovered only; pending would be noisy on every edit.
  const announcement = visible && kind !== 'pending' ? label : '';

  return (
    <>
      <Popover.Root>
        <Popover.Trigger>
          <button
            type="button"
            aria-label={label}
            aria-hidden={!visible}
            tabIndex={visible ? 0 : -1}
            className={clsx(
              '-ml-2 grid size-11 shrink-0 place-items-center rounded-full',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--accent-8)]',
              '[@media(hover:hover)]:hover:bg-gray-a3',
              'transition-opacity',
              EASE_OUT,
              visible
                ? 'opacity-100 duration-200'
                : 'pointer-events-none opacity-0 duration-150',
            )}
          >
            <span
              aria-hidden
              className={clsx(
                'block size-2 rounded-full',
                'transition-[transform,background-color] motion-reduce:transition-[background-color]',
                EASE_OUT,
                visible
                  ? 'scale-100 duration-200'
                  : 'scale-50 duration-150 motion-reduce:scale-100',
                DOT[kind],
              )}
            />
          </button>
        </Popover.Trigger>
        <Popover.Content size="1" style={{ maxWidth: 240 }}>
          <Text as="p" size="2">
            {detail}
          </Text>
        </Popover.Content>
      </Popover.Root>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
};

export default SyncIndicator;
