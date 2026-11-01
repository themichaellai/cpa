import { describe, expect, test } from 'bun:test';

import type { SyncStatus } from '../replicache';
import {
  initialState,
  type Kind,
  reduce,
  type State,
  timeoutFor,
  view,
} from './syncIndicatorMachine';

type Shown = Kind | 'hidden';

/**
 * Runs the machine against a fake clock: applies each [time, status] step and
 * fires timeouts as they come due (the way SyncIndicator's effects do). On a
 * same-millisecond tie the status step goes first; in React either could, so
 * tests avoid ties.
 * Returns the visible changes as [time, kind | 'hidden'] pairs.
 */
const simulate = (
  steps: ReadonlyArray<readonly [number, SyncStatus]>,
  until = 20_000,
): Array<[number, Shown]> => {
  let state: State = initialState;
  let timerAt: number | null = null;
  const trace: Array<[number, Shown]> = [];
  let last: Shown = 'hidden';

  const apply = (next: State, now: number) => {
    if (next !== state) {
      state = next;
      const ms = timeoutFor(state, now);
      timerAt = ms == null ? null : now + ms;
    }
    const v = view(state);
    const shown: Shown = v.visible ? v.kind : 'hidden';
    if (shown !== last) {
      trace.push([now, shown]);
      last = shown;
    }
  };

  const queue = [...steps];
  for (;;) {
    const nextStep = queue[0];
    if (timerAt != null && (nextStep == null || timerAt < nextStep[0])) {
      if (timerAt > until) break;
      const now = timerAt;
      apply(reduce(state, { type: 'timeout', now }), now);
    } else if (nextStep != null) {
      queue.shift();
      const [now, status] = nextStep;
      apply(reduce(state, { type: 'status', status, now }), now);
    } else {
      break;
    }
  }
  return trace;
};

describe('pending', () => {
  test('a normal push shows nothing', () => {
    expect(
      simulate([
        [0, 'pending'],
        [300, 'synced'],
      ]),
    ).toEqual([]);
  });

  test('a slow sync shows gray after 1s, hides when synced', () => {
    expect(
      simulate([
        [0, 'pending'],
        [3000, 'synced'],
      ]),
    ).toEqual([
      [1000, 'pending'],
      [3000, 'hidden'],
    ]);
  });

  test('stays visible at least 800ms', () => {
    expect(
      simulate([
        [0, 'pending'],
        [1200, 'synced'],
      ]),
    ).toEqual([
      [1000, 'pending'],
      [1800, 'hidden'],
    ]);
  });

  test('new edits during the hold keep it up without resetting the clock', () => {
    expect(
      simulate([
        [0, 'pending'],
        [1200, 'synced'],
        [1300, 'pending'],
        [1400, 'synced'],
      ]),
    ).toEqual([
      [1000, 'pending'],
      [1800, 'hidden'],
    ]);
  });
});

describe('offline', () => {
  test('a stale offline flag cleared by the next push shows nothing', () => {
    expect(
      simulate([
        [0, 'offline'],
        [10, 'pending'],
        [500, 'synced'],
      ]),
    ).toEqual([]);
  });

  test('real offline shows amber after 1.5s, then green once synced', () => {
    expect(
      simulate([
        [0, 'offline'],
        [5000, 'synced'],
      ]),
    ).toEqual([
      [1500, 'offline'],
      [5000, 'recovered'],
      [6500, 'hidden'],
    ]);
  });

  test('back online but unconfirmed shows gray, then green', () => {
    expect(
      simulate([
        [0, 'offline'],
        [5000, 'pending'],
        [8000, 'synced'],
      ]),
    ).toEqual([
      [1500, 'offline'],
      [5000, 'pending'],
      [8000, 'recovered'],
      [9500, 'hidden'],
    ]);
  });

  test('going offline while gray waits 1.5s before turning amber', () => {
    expect(
      simulate([
        [0, 'pending'],
        [2000, 'offline'],
        [6000, 'synced'],
      ]),
    ).toEqual([
      [1000, 'pending'],
      [3500, 'offline'],
      [6000, 'recovered'],
      [7500, 'hidden'],
    ]);
  });

  test('a brief offline blip while gray never turns amber or green', () => {
    expect(
      simulate([
        [0, 'pending'],
        [2000, 'offline'],
        [2500, 'pending'],
        [4000, 'synced'],
      ]),
    ).toEqual([
      [1000, 'pending'],
      [4000, 'hidden'],
    ]);
  });

  test('going offline during the green confirmation shows gray, then amber', () => {
    expect(
      simulate([
        [0, 'offline'],
        [5000, 'synced'],
        [5500, 'offline'],
      ]),
    ).toEqual([
      [1500, 'offline'],
      [5000, 'recovered'],
      [5500, 'pending'],
      [7000, 'offline'],
    ]);
  });
});

describe('reduce', () => {
  test('returns the same state for a repeated status, so timers keep running', () => {
    const arming = reduce(initialState, {
      type: 'status',
      status: 'offline',
      now: 0,
    });
    expect(reduce(arming, { type: 'status', status: 'offline', now: 1 })).toBe(
      arming,
    );
  });

  test('takes the next colour while invisible, before appearing', () => {
    // Faded out after green; the next slow edit shouldn't animate from green.
    const arming = reduce(
      { tag: 'hidden', kind: 'recovered' },
      { type: 'status', status: 'pending', now: 0 },
    );
    expect(view(arming)).toEqual({ visible: false, kind: 'pending' });
  });

  test('keeps the last colour while fading out', () => {
    const hidden = reduce({ tag: 'recovered' }, { type: 'timeout', now: 0 });
    expect(view(hidden)).toEqual({ visible: false, kind: 'recovered' });
  });
});
