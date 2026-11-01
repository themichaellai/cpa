/**
 * State machine for the sync indicator dot. Pure (no React), so it's testable
 * on its own; `SyncIndicator` drives it with status changes and clock ticks.
 *
 *   hidden   ─pending→ arming(pending) ─1s→   pending (gray)
 *   hidden   ─offline→ arming(offline) ─1.5s→ offline (amber)
 *   arming   ─synced→  hidden
 *   arming   ─other non-synced status→ arming(that status), delay restarts
 *   pending  ─synced→  holding ─rest of 800ms→ hidden
 *                      (or recovered, if it came from offline)
 *   pending  ─offline→ pending(offlineAt) ─1.5s→ offline
 *   offline  ─pending→ pending(wasOffline)
 *   offline  ─synced→  recovered (green) ─1.5s→ hidden
 *   holding, recovered ─pending→ pending
 *   holding, recovered ─offline→ pending(offlineAt) ─1.5s→ offline
 *
 * - Pending only shows after 1s, so normal pushes show nothing.
 * - Offline only shows after 1.5s, because Replicache stays "offline" after any
 *   failed request until the next one succeeds; the next edit's push usually
 *   clears it within ms. While the gray dot is showing, going offline waits
 *   the same 1.5s (`offlineAt`) before turning amber.
 * - Once shown, the dot stays at least 800ms so it never flashes.
 * - "Recovered" (green) only follows a real offline period.
 *
 * Timing: states store absolute deadlines, and every event carries `now`.
 * The reducer first applies any deadlines that have passed (timestamped at
 * the deadline itself), then the event. So a late, early, extra or stale
 * tick can't skip a delay or fire a transition meant for an earlier state;
 * the driver only has to wake the reducer at `deadlineOf(state)`.
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
  // Not visible yet; shows `next` at `showAt`. The dot takes `next`'s colour
  // now, while invisible, so it doesn't animate from the previous colour.
  | { tag: 'arming'; next: 'pending' | 'offline'; showAt: number }
  // Gray. `since` = when the dot appeared, for the minimum visible time.
  // `offlineAt`, if set, is when it turns amber.
  | {
      tag: 'pending';
      since: number;
      wasOffline: boolean;
      offlineAt: number | null;
    }
  // Amber.
  | { tag: 'offline'; since: number }
  // Gray; everything synced, but staying up until `hideAt`.
  | { tag: 'holding'; since: number; hideAt: number }
  // Green until `hideAt`; confirms sync after an offline period.
  | { tag: 'recovered'; hideAt: number };

export type Event =
  | { type: 'status'; status: SyncStatus; now: number }
  // Wakes the machine so passed deadlines take effect. Safe at any time.
  | { type: 'tick'; now: number };

export const initialState: State = { tag: 'hidden', kind: 'pending' };

const pending = (
  since: number,
  opts: { wasOffline?: boolean; offlineAt?: number | null } = {},
): State => ({
  tag: 'pending',
  since,
  wasOffline: opts.wasOffline ?? false,
  offlineAt: opts.offlineAt ?? null,
});

const arming = (next: 'pending' | 'offline', now: number): State => ({
  tag: 'arming',
  next,
  showAt: now + (next === 'pending' ? SHOW_DELAY_MS : OFFLINE_DELAY_MS),
});

/** When this state next changes on its own, or null if it doesn't. */
export const deadlineOf = (state: State): number | null => {
  switch (state.tag) {
    case 'arming':
      return state.showAt;
    case 'pending':
      return state.offlineAt;
    case 'holding':
    case 'recovered':
      return state.hideAt;
    default:
      return null;
  }
};

/** The transition when `state`'s deadline passes (at time `at`). */
const expire = (state: State, at: number): State => {
  switch (state.tag) {
    case 'arming':
      return state.next === 'pending'
        ? pending(at)
        : { tag: 'offline', since: at };
    case 'pending':
      return { tag: 'offline', since: state.since };
    case 'holding':
      return { tag: 'hidden', kind: 'pending' };
    case 'recovered':
      return { tag: 'hidden', kind: 'recovered' };
    default:
      return state;
  }
};

const onStatus = (state: State, status: SyncStatus, now: number): State => {
  switch (state.tag) {
    case 'hidden':
      return status === 'synced' ? state : arming(status, now);
    case 'arming':
      if (status === 'synced') return { tag: 'hidden', kind: state.next };
      return state.next === status ? state : arming(status, now);
    case 'pending':
      if (status === 'synced') {
        return state.wasOffline
          ? { tag: 'recovered', hideAt: now + RECOVERED_MS }
          : {
              tag: 'holding',
              since: state.since,
              hideAt: state.since + MIN_VISIBLE_MS,
            };
      }
      if (status === 'offline') {
        return state.offlineAt != null
          ? state
          : { ...state, offlineAt: now + OFFLINE_DELAY_MS };
      }
      return state.offlineAt == null ? state : { ...state, offlineAt: null };
    case 'offline':
      if (status === 'offline') return state;
      if (status === 'synced') {
        return { tag: 'recovered', hideAt: now + RECOVERED_MS };
      }
      return pending(state.since, { wasOffline: true });
    case 'holding':
      if (status === 'synced') return state;
      return pending(state.since, {
        offlineAt: status === 'offline' ? now + OFFLINE_DELAY_MS : null,
      });
    case 'recovered':
      if (status === 'synced') return state;
      return pending(now, {
        offlineAt: status === 'offline' ? now + OFFLINE_DELAY_MS : null,
      });
  }
};

/** Returns the same object when nothing changes, so timers aren't restarted. */
export const reduce = (state: State, event: Event): State => {
  // Deadlines that passed before `now` happened before this event.
  let next = state;
  for (;;) {
    const deadline = deadlineOf(next);
    if (deadline == null || deadline > event.now) break;
    next = expire(next, deadline);
  }
  return event.type === 'status'
    ? onStatus(next, event.status, event.now)
    : next;
};

export const view = (state: State): { visible: boolean; kind: Kind } => {
  switch (state.tag) {
    case 'hidden':
      return { visible: false, kind: state.kind };
    case 'arming':
      return { visible: false, kind: state.next };
    case 'pending':
    case 'holding':
      return { visible: true, kind: 'pending' };
    case 'offline':
      return { visible: true, kind: 'offline' };
    case 'recovered':
      return { visible: true, kind: 'recovered' };
  }
};
