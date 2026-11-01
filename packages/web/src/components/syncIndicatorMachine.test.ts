import { describe, expect, test } from 'bun:test';

import type { SyncStatus } from '../replicache';
import {
  deadlineOf,
  initialState,
  type Kind,
  reduce,
  type State,
  view,
} from './syncIndicatorMachine';

type Shown = Kind | 'hidden';

/**
 * Runs the machine against a fake clock: applies each [time, status] step and
 * ticks at each state's deadline (the way SyncIndicator's effects do).
 * `extraTicks` adds ticks at arbitrary times, e.g. stale or spurious timers.
 * Returns the visible changes as [time, kind | 'hidden'] pairs.
 */
const simulate = (
  steps: ReadonlyArray<readonly [number, SyncStatus]>,
  { until = 20_000, extraTicks = [] as ReadonlyArray<number> } = {},
): Array<[number, Shown]> => {
  let state: State = initialState;
  const trace: Array<[number, Shown]> = [];
  let last: Shown = 'hidden';

  const apply = (event: Parameters<typeof reduce>[1]) => {
    state = reduce(state, event);
    const v = view(state);
    const shown: Shown = v.visible ? v.kind : 'hidden';
    if (shown !== last) {
      trace.push([event.now, shown]);
      last = shown;
    }
  };

  const queue = [...steps];
  const ticks = [...extraTicks].sort((a, b) => a - b);
  let now = 0;
  for (;;) {
    const deadline = deadlineOf(state);
    const candidates = [
      deadline == null ? Infinity : Math.max(deadline, now),
      ticks[0] ?? Infinity,
      queue[0]?.[0] ?? Infinity,
    ];
    now = Math.min(...candidates);
    if (now === Infinity || now > until) break;
    if (now === queue[0]?.[0]) {
      const [, status] = queue.shift()!;
      apply({ type: 'status', status, now });
    } else {
      if (now === ticks[0]) ticks.shift();
      apply({ type: 'tick', now });
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
    const arming = reduce({ tag: 'hidden', kind: 'recovered' } as State, {
      type: 'status',
      status: 'pending',
      now: 0,
    });
    expect(view(arming)).toEqual({ visible: false, kind: 'pending' });
  });

  test('keeps the last colour while fading out', () => {
    const hidden = reduce(
      { tag: 'recovered', hideAt: 0 },
      { type: 'tick', now: 0 },
    );
    expect(view(hidden)).toEqual({ visible: false, kind: 'recovered' });
  });
});

describe('ticks', () => {
  const timelines: ReadonlyArray<ReadonlyArray<readonly [number, SyncStatus]>> =
    [
      [
        [0, 'pending'],
        [1200, 'synced'],
        [1300, 'pending'],
        [1400, 'synced'],
      ],
      [
        [0, 'offline'],
        [5000, 'pending'],
        [8000, 'synced'],
      ],
      [
        [0, 'pending'],
        [2000, 'offline'],
        [2500, 'pending'],
        [4000, 'synced'],
      ],
      [
        [0, 'offline'],
        [5000, 'synced'],
        [5500, 'offline'],
        [9000, 'synced'],
      ],
    ];

  test('extra ticks at any time never change the outcome', () => {
    const everyFewMs = Array.from({ length: 2000 }, (_, i) => i * 7 + 3);
    for (const steps of timelines) {
      expect(simulate(steps, { extraTicks: everyFewMs })).toEqual(
        simulate(steps),
      );
    }
  });

  test("a stale tick from the previous state can't skip the offline delay", () => {
    // Gray dot, sync done (holding until 1800), then offline at 1700. A tick
    // left over from the holding deadline must not turn it amber early.
    expect(
      simulate(
        [
          [0, 'pending'],
          [1200, 'synced'],
          [1700, 'offline'],
        ],
        { extraTicks: [1800] },
      ),
    ).toEqual([
      [1000, 'pending'],
      [3200, 'offline'],
    ]);
  });

  test('a late tick still times transitions from the deadline', () => {
    // Shown at 1000 (the deadline), even though the first tick is at 1500.
    const state = reduce(
      reduce(initialState, {
        type: 'status',
        status: 'pending',
        now: 0,
      }),
      { type: 'tick', now: 1500 },
    );
    expect(state).toMatchObject({ tag: 'pending', since: 1000 });
  });
});
