/**
 * State machine for the sync indicator dot. Pure (no React), so it's testable
 * on its own; `SyncIndicator` drives it with status changes and timeouts.
 *
 *   hidden   ─pending→ arming(pending) ─1s→   pending (gray)
 *   hidden   ─offline→ arming(offline) ─1.5s→ offline (amber)
 *   arming   ─synced→  hidden
 *   pending  ─synced→  holding ─rest of 800ms→ hidden
 *                      (or recovered, if it came from offline)
 *   pending  ─offline→ pending(goingOffline) ─1.5s→ offline
 *   offline  ─pending→ pending(wasOffline)
 *   offline  ─synced→  recovered (green) ─1.5s→ hidden
 *   holding, recovered ─pending/offline→ pending
 *
 * - Pending only shows after 1s, so normal pushes show nothing.
 * - Offline only shows after 1.5s, because Replicache stays "offline" after any
 *   failed request until the next one succeeds; the next edit's push usually
 *   clears it within ms. While the gray dot is showing, going offline waits
 *   the same 1.5s (`goingOffline`) before turning amber.
 * - Once shown, the dot stays at least 800ms so it never flashes.
 * - "Recovered" (green) only follows a real offline period.
 */
import type { SyncStatus } from '../replicache';

export type Kind = 'pending' | 'offline' | 'recovered';

export const SHOW_DELAY_MS = 1000;
export const OFFLINE_DELAY_MS = 1500;
export const MIN_VISIBLE_MS = 800;
export const RECOVERED_MS = 1500;

export type State =
  // Not visible. `kind` is the last colour shown, kept while the dot fades out.
  | { tag: 'hidden'; kind: Kind }
  // Not visible yet; waiting out the show delay before showing `next`.
  | { tag: 'arming'; next: 'pending' | 'offline'; kind: Kind }
  // Gray. `since` = when the dot appeared, for the minimum visible time.
  | {
      tag: 'pending';
      since: number;
      wasOffline: boolean;
      goingOffline: boolean;
    }
  // Amber.
  | { tag: 'offline'; since: number }
  // Gray; everything synced, but staying up for the minimum visible time.
  | { tag: 'holding'; since: number }
  // Green; briefly confirms sync after an offline period.
  | { tag: 'recovered' };

export type Event =
  | { type: 'status'; status: SyncStatus; now: number }
  | { type: 'timeout'; now: number };

export const initialState: State = { tag: 'hidden', kind: 'pending' };

const showPending = (
  since: number,
  opts: { wasOffline?: boolean; goingOffline?: boolean } = {},
): State => ({
  tag: 'pending',
  since,
  wasOffline: opts.wasOffline ?? false,
  goingOffline: opts.goingOffline ?? false,
});

/** Returns the same object when nothing changes, so timers aren't restarted. */
export const reduce = (state: State, event: Event): State => {
  if (event.type === 'timeout') {
    switch (state.tag) {
      case 'arming':
        return state.next === 'pending'
          ? showPending(event.now)
          : { tag: 'offline', since: event.now };
      case 'pending':
        return state.goingOffline
          ? { tag: 'offline', since: state.since }
          : state;
      case 'holding':
        return { tag: 'hidden', kind: 'pending' };
      case 'recovered':
        return { tag: 'hidden', kind: 'recovered' };
      default:
        return state;
    }
  }

  const { status, now } = event;
  switch (state.tag) {
    case 'hidden':
    case 'arming': {
      if (status === 'synced') {
        return state.tag === 'hidden'
          ? state
          : { tag: 'hidden', kind: state.kind };
      }
      if (state.tag === 'arming' && state.next === status) return state;
      return { tag: 'arming', next: status, kind: state.kind };
    }
    case 'pending':
      if (status === 'synced') {
        return state.wasOffline
          ? { tag: 'recovered' }
          : { tag: 'holding', since: state.since };
      }
      if (state.goingOffline === (status === 'offline')) return state;
      return { ...state, goingOffline: status === 'offline' };
    case 'offline':
      if (status === 'offline') return state;
      if (status === 'synced') return { tag: 'recovered' };
      return showPending(state.since, { wasOffline: true });
    case 'holding':
      if (status === 'synced') return state;
      return showPending(state.since, {
        goingOffline: status === 'offline',
      });
    case 'recovered':
      if (status === 'synced') return state;
      return showPending(now, { goingOffline: status === 'offline' });
  }
};

/** How long until this state's `timeout` event, or null if it has none. */
export const timeoutFor = (state: State, now: number): number | null => {
  switch (state.tag) {
    case 'arming':
      return state.next === 'pending' ? SHOW_DELAY_MS : OFFLINE_DELAY_MS;
    case 'pending':
      return state.goingOffline ? OFFLINE_DELAY_MS : null;
    case 'holding':
      return Math.max(0, MIN_VISIBLE_MS - (now - state.since));
    case 'recovered':
      return RECOVERED_MS;
    default:
      return null;
  }
};

export const view = (state: State): { visible: boolean; kind: Kind } => {
  switch (state.tag) {
    case 'hidden':
    case 'arming':
      return { visible: false, kind: state.kind };
    case 'pending':
    case 'holding':
      return { visible: true, kind: 'pending' };
    case 'offline':
      return { visible: true, kind: 'offline' };
    case 'recovered':
      return { visible: true, kind: 'recovered' };
  }
};
