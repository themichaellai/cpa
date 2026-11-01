import { useEffect, useId, useRef, useState } from 'react';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';

import { useSyncStatus, type SyncStatus } from '../replicache';

type Kind = 'pending' | 'offline' | 'recovered';

// A normal push finishes in a few hundred ms; don't show anything for those.
const SHOW_DELAY_MS = 1000;
// Replicache stays "offline" after any failed request (e.g. a blip or the
// device waking) until the next one succeeds, so the next edit's push usually
// clears it within ms. Wait before treating it as really offline.
const OFFLINE_DELAY_MS = 1500;
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
      const goOffline = () => {
        wasOffline.current = true;
        show('offline');
      };
      if (visible && kind === 'offline') goOffline();
      else timer = setTimeout(goOffline, OFFLINE_DELAY_MS);
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

// No change counts: they can lag behind and would read "0 changes" while the
// dot fades out.
const COPY: Record<Kind, { label: string; detail: string }> = {
  pending: {
    label: 'Changes waiting to sync',
    detail: 'Saved on this device. Waiting for the server to confirm.',
  },
  offline: {
    label: 'Offline. Changes saved on this device',
    detail:
      "Can't reach the server. Your changes are safe and will sync when you're back online.",
  },
  recovered: {
    label: 'All changes synced',
    detail: 'Everything is saved.',
  },
};

const DOT: Record<Kind, string> = {
  pending: 'bg-[var(--gray-9)]',
  offline: 'bg-[var(--amber-9)]',
  recovered: 'bg-[var(--grass-9)]',
};

const EASE_OUT = 'ease-[cubic-bezier(0.23,1,0.32,1)]';

/**
 * Explanation bubble: a disclosure that opens on hover for mouse users and
 * toggles on tap/click, closing on outside press or Escape. Hand-rolled
 * instead of Radix Popover, whose Slot (react-slot 1.0.x, via Radix Themes 2)
 * warns under React 19.
 */
const useBubble = (enabled: boolean) => {
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const open = enabled && (hovered || pinned);

  // Reset when the indicator hides so it doesn't reopen by itself later.
  // pointerleave may not fire once the button goes pointer-events-none.
  useEffect(() => {
    if (!enabled) {
      setPinned(false);
      setHovered(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!open) return;
    const close = () => {
      setPinned(false);
      setHovered(false);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return {
    open,
    rootRef,
    rootProps: {
      onPointerEnter: (e: React.PointerEvent) => {
        if (e.pointerType === 'mouse') setHovered(true);
      },
      onPointerLeave: () => setHovered(false),
    },
    // Toggle what's visible, so a click can close a hover-opened bubble.
    toggle: () => {
      const next = !open;
      setPinned(next);
      if (!next) setHovered(false);
    },
  };
};

const SyncIndicator: React.FC = () => {
  const { status } = useSyncStatus();
  const { visible, kind } = useIndicatorState(status);
  const { label, detail } = COPY[kind];
  const bubble = useBubble(visible);
  const bubbleId = useId();
  // Announce offline / recovered only; pending would be noisy on every edit.
  const announcement = visible && kind !== 'pending' ? label : '';

  return (
    <>
      {/* Not `relative`: the bubble anchors to the header title area (see
          Calendar) so it starts at the left edge and fits on narrow phones. */}
      <span ref={bubble.rootRef} {...bubble.rootProps}>
        <button
          type="button"
          aria-label={label}
          aria-hidden={!visible}
          aria-expanded={bubble.open}
          aria-controls={bubbleId}
          tabIndex={visible ? 0 : -1}
          onClick={bubble.toggle}
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
        {/* The transparent pt-1 wrapper bridges the gap below the dot so the
            pointer can move into the bubble without it closing. */}
        <span
          id={bubbleId}
          className={clsx(
            'absolute left-0 top-full z-10 block w-max max-w-[240px] origin-top-left pt-1',
            'transition-[opacity,transform,visibility] motion-reduce:transition-[opacity,visibility]',
            EASE_OUT,
            bubble.open
              ? 'visible translate-y-0 scale-100 opacity-100 duration-150'
              : 'pointer-events-none invisible -translate-y-1 scale-[0.97] opacity-0 duration-100 motion-reduce:translate-y-0 motion-reduce:scale-100',
          )}
        >
          <span className="block rounded-4 bg-[var(--color-panel-solid)] px-3 py-2 shadow-5">
            <Text as="span" size="2" className="block">
              {detail}
            </Text>
          </span>
        </span>
      </span>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </>
  );
};

export default SyncIndicator;
