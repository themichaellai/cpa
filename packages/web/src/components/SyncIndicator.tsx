import { useEffect, useId, useReducer, useRef, useState } from 'react';
import { Text } from '@radix-ui/themes';
import clsx from 'clsx';

import { useSyncStatus, type SyncStatus } from '../replicache';
import {
  deadlineOf,
  initialState,
  reduce,
  view,
  type Kind,
} from './syncIndicatorMachine';

const useIndicatorState = (status: SyncStatus) => {
  const [state, dispatch] = useReducer(reduce, initialState);

  useEffect(() => {
    dispatch({ type: 'status', status, now: Date.now() });
  }, [status]);

  // Wake the machine at the state's deadline. Ticks are safe at any time (the
  // reducer checks deadlines itself), so a stale timer is harmless. `now` is
  // at least the deadline in case a timer fires a millisecond early, which
  // would otherwise leave the state unchanged and nothing rescheduled.
  useEffect(() => {
    const deadline = deadlineOf(state);
    if (deadline == null) return;
    const timer = setTimeout(
      () => dispatch({ type: 'tick', now: Math.max(Date.now(), deadline) }),
      Math.max(0, deadline - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [state]);

  return view(state);
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

  // While hidden, make the whole indicator inert: no hover (the wrapper's box
  // would otherwise still get pointer events) and no keyboard focus left on
  // an invisible button. Set via the DOM because @types/react 18 lacks the
  // `inert` prop. Also reset so the bubble doesn't reopen by itself later.
  useEffect(() => {
    if (rootRef.current) rootRef.current.inert = !enabled;
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
