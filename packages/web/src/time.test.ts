// Run under several device zones with `bun run test` (see scripts/test-tz.ts).
// Optional: set JSJODA_GOLDEN_DIR to a directory of <Zone_Name>.json files
// captured from js-joda + @js-joda/timezone to compare zonedAt output exactly.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { convert, LocalDate, nativeJs } from '@js-joda/core';
import {
  formatTimeForDisplay,
  formatZoned,
  IsoDateTime,
  now,
  parseDateTime,
  zonedAt,
  zonedNowOn,
} from './time';

const TZ = process.env.TZ ?? '';
const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

// What the Go server accepts: RFC3339 with seconds, then [IANA zone].
const WIRE_RE =
  /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(Z|[+-]\d\d:\d\d)\[([^\]]+)\]$/;

// Plain string so toBe() accepts string literals.
const at = (iso: string, secondOfDay: number): string | null =>
  zonedAt(LocalDate.parse(iso), secondOfDay);

const forInput = (s: string) =>
  parseDateTime(s).map((d) =>
    d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
  );

describe(`time helpers (TZ=${TZ || 'unset'}, Intl zone ${deviceZone})`, () => {
  test('zonedAt rejects NaN, negative and >= 86400 seconds', () => {
    const d = LocalDate.parse('2026-06-15');
    expect(zonedAt(d, NaN)).toBeNull();
    expect(zonedAt(d, -1)).toBeNull();
    expect(zonedAt(d, 86400)).toBeNull();
    expect(zonedAt(d, 90000)).toBeNull();
    expect(zonedAt(d, Infinity)).toBeNull();
    expect(zonedAt(d, 86399.9)).not.toBeNull();
    expect(zonedAt(d, 59.9)?.slice(11, 19)).toBe('00:00:59');
  });

  test('zonedAt emits the wire format and round-trips the wall clock', () => {
    const dates = [
      '2026-01-15',
      '2026-03-08',
      '2026-03-29',
      '2026-04-05',
      '2026-06-15',
      '2026-09-06',
      '2026-09-27',
      '2026-10-04',
      '2026-11-01',
      '2024-02-29',
    ];
    for (const iso of dates) {
      const date = LocalDate.parse(iso);
      for (let s = 0; s < 86400; s += 900) {
        const out = zonedAt(date, s)!;
        const m = WIRE_RE.exec(out);
        expect(m).not.toBeNull();
        expect(m![8]).toBe(deviceZone);
        // Offset agrees with the native offset of the emitted wall clock.
        const parsed = parseDateTime(out).unsafeCoerce();
        const wall = `${m![4]}:${m![5]}:${m![6]}`;
        const expectedWall = [
          Math.floor(s / 3600),
          Math.floor(s / 60) % 60,
          s % 60,
        ]
          .map((n) => String(n).padStart(2, '0'))
          .join(':');
        if (wall === expectedWall) {
          expect(out.slice(0, 10)).toBe(iso);
        } else {
          // Only allowed inside a DST gap: shifted forward, same instant as
          // the pre-transition offset would give.
          expect(out > `${iso}T${expectedWall}`).toBe(true);
        }
        expect(formatZoned(parsed)).toBe(out);
      }
    }
  });

  const goldenDir = process.env.JSJODA_GOLDEN_DIR;
  const goldenFile =
    goldenDir && join(goldenDir, `${TZ.replace(/\//g, '_')}.json`);
  test.if(Boolean(goldenFile && existsSync(goldenFile)))(
    'zonedAt and display match js-joda + @js-joda/timezone golden output',
    () => {
      const golden = JSON.parse(readFileSync(goldenFile!, 'utf8')) as {
        systemDefault: string;
        zoned: Array<[string, number, string]>;
        display: Array<[string, string, string]>;
      };
      expect(deviceZone).toBe(golden.systemDefault);
      const mismatches = golden.zoned.filter(
        ([d, s, out]) => zonedAt(LocalDate.parse(d), s) !== out,
      );
      expect(mismatches.slice(0, 5)).toEqual([]);
      expect(golden.zoned.length).toBeGreaterThan(400);
      for (const [s, disp, input] of golden.display) {
        expect([
          s,
          formatTimeForDisplay(s as IsoDateTime).unsafeCoerce(),
        ]).toEqual([s, disp]);
        expect([s, forInput(s).unsafeCoerce()]).toEqual([s, input]);
      }
    },
  );

  test.if(TZ === 'America/New_York')('New York DST golden values', () => {
    expect(at('2026-03-08', 9000)).toBe(
      '2026-03-08T03:30:00-04:00[America/New_York]',
    );
    expect(at('2026-11-01', 5400)).toBe(
      '2026-11-01T01:30:00-04:00[America/New_York]',
    );
    expect(at('2026-11-01', 9000)).toBe(
      '2026-11-01T02:30:00-05:00[America/New_York]',
    );
    expect(at('2026-06-15', 0)).toBe(
      '2026-06-15T00:00:00-04:00[America/New_York]',
    );
    expect(at('2026-01-15', 86399)).toBe(
      '2026-01-15T23:59:59-05:00[America/New_York]',
    );
  });

  test.if(TZ === 'America/Havana')('Havana midnight DST gap', () => {
    expect(at('2026-03-08', 0)).toBe(
      '2026-03-08T01:00:00-04:00[America/Havana]',
    );
  });

  test.if(TZ === 'UTC')('UTC device emits Z[UTC]', () => {
    expect(at('2026-06-15', 3723)).toBe('2026-06-15T01:02:03Z[UTC]');
  });

  test.if(TZ === 'Asia/Kathmandu' || TZ === 'Pacific/Chatham')(
    'fractional-hour offsets',
    () => {
      const out = zonedAt(LocalDate.parse('2026-06-15'), 0)!;
      expect(out).toMatch(TZ === 'Asia/Kathmandu' ? /\+05:45\[/ : /\+12:45\[/);
    },
  );

  test('zonedAt keeps years below 100', () => {
    const out = zonedAt(LocalDate.of(50, 3, 1), 3600)!;
    expect(out.slice(0, 19)).toBe('0050-03-01T01:00:00');
    const d = parseDateTime('0050-03-01T10:00:00Z[UTC]').unsafeCoerce();
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()]).toEqual([
      50, 2, 1, 10,
    ]);
  });

  test('zonedNowOn uses the given date and the current time', () => {
    const before = new Date();
    const out = zonedNowOn(LocalDate.parse('2026-06-15'));
    const m = WIRE_RE.exec(out);
    expect(m).not.toBeNull();
    expect(out.slice(0, 10)).toBe('2026-06-15');
    const secs = Number(m![4]) * 3600 + Number(m![5]) * 60 + Number(m![6]);
    const nowSecs =
      before.getHours() * 3600 + before.getMinutes() * 60 + before.getSeconds();
    // Allow a little slack, or a DST gap shift on 2026-06-15 in the far south.
    expect(Math.abs(secs - nowSecs) <= 2 || secs - nowSecs === 3600).toBe(true);
  });

  test('now() matches the wire format, always with seconds', () => {
    const before = Date.now();
    const out = now();
    const m = WIRE_RE.exec(out);
    expect(m).not.toBeNull();
    expect(m![8]).toBe(deviceZone);
    const instant = Date.parse(out.replace(/\[.*\]$/, ''));
    expect(Math.abs(instant - before)).toBeLessThan(2000);
  });

  test('formatZoned uses the native offset at that instant', () => {
    const d = new Date(Date.UTC(2026, 6, 1, 12, 0, 0));
    const out = formatZoned(d);
    expect(Date.parse(out.replace(/\[.*\]$/, ''))).toBe(d.getTime());
  });

  describe('parseDateTime', () => {
    const right = [
      '2026-10-31T21:18:55.544-04:00[America/New_York]',
      '2026-10-31T21:18:55-04:00[America/New_York]',
      '2026-10-31T21:18:55.123456789-04:00[America/New_York]',
      '2026-06-15T10:00:00Z[UTC]',
      '2026-06-15T10:00:00+05:45[Asia/Kathmandu]',
      '2026-06-15T10:00:00+05:30[Asia/Calcutta]',
      '2026-06-15T10:00:00-04:00[US/Eastern]',
      '2024-02-29T10:00:00Z[UTC]',
      // js-joda's toString() dropped zero seconds; still parse those.
      '2026-06-15T10:00-04:00[America/New_York]',
    ];
    for (const s of right) {
      test(`Right: ${s}`, () => {
        expect(parseDateTime(s).isRight()).toBe(true);
      });
    }
    const left = [
      '',
      'garbage',
      '2026-06-15',
      '2026-06-15T10:00:00',
      '2026-06-15T10:00:00Z',
      '2026-06-15T10:00:00-04:00',
      '2026-02-30T10:00:00Z[UTC]',
      '2025-02-29T10:00:00Z[UTC]',
      '2026-04-31T10:00:00Z[UTC]',
      '2026-13-01T10:00:00Z[UTC]',
      '2026-00-01T10:00:00Z[UTC]',
      '2026-06-00T10:00:00Z[UTC]',
      '2026-06-15T24:00:00Z[UTC]',
      '2026-06-15T10:60:00Z[UTC]',
      '2026-06-15T10:00:60Z[UTC]',
      '2026-06-15T10:00:00Z[Bogus/Zone]',
      '2026-06-15T10:00:00Z[]',
      '2026-06-15T10:00:00Z[UTC] ',
      '2026-06-15T10:00:00+0400[America/New_York]',
    ];
    for (const s of left) {
      test(`Left: ${JSON.stringify(s)}`, () => {
        const r = parseDateTime(s);
        expect(r.isLeft()).toBe(true);
        expect(formatTimeForDisplay(s as IsoDateTime).orDefault('Set')).toBe(
          'Set',
        );
        expect(forInput(s).orDefault('00:00')).toBe('00:00');
      });
    }
  });

  describe('display keeps the wall clock of strings from other zones', () => {
    const cases: Array<[string, string, string]> = [
      // Stale-tzdata regression: js-joda tz 2.18.2 showed 9:00 AM / 11:00 AM.
      ['2025-07-01T10:00:00-03:00[America/Asuncion]', '10:00 AM', '10:00'],
      ['2025-07-01T10:00:00+05:00[Asia/Almaty]', '10:00 AM', '10:00'],
      ['2025-07-01T10:00:00+09:00[Asia/Tokyo]', '10:00 AM', '10:00'],
      ['2025-07-01T21:45:00+05:45[Asia/Kathmandu]', '9:45 PM', '21:45'],
      ['2026-01-15T00:05:00+13:45[Pacific/Chatham]', '12:05 AM', '00:05'],
      ['2026-01-15T13:30:00-03:30[America/St_Johns]', '1:30 PM', '13:30'],
      ['2026-01-15T08:00:00Z[UTC]', '8:00 AM', '08:00'],
      // Offset inconsistent with the zone: wall clock still wins, like the server.
      ['2026-01-15T08:00:00+09:00[America/New_York]', '8:00 AM', '08:00'],
    ];
    for (const [s, disp, input] of cases) {
      test(s, () => {
        expect(formatTimeForDisplay(s as IsoDateTime).unsafeCoerce()).toBe(
          disp,
        );
        expect(forInput(s).unsafeCoerce()).toBe(input);
      });
    }
  });

  describe('@js-joda/core LocalDate without @js-joda/timezone', () => {
    test('LocalDate.now() is the native local date', () => {
      const d = new Date();
      const expected = [
        String(d.getFullYear()).padStart(4, '0'),
        String(d.getMonth() + 1).padStart(2, '0'),
        String(d.getDate()).padStart(2, '0'),
      ].join('-');
      expect(LocalDate.now().toString()).toBe(expected);
    });

    test('LocalDate.from(nativeJs(date)) uses local fields', () => {
      for (const [y, m, d, h] of [
        [2026, 0, 1, 0],
        [2026, 2, 8, 12],
        [2026, 5, 15, 23],
        [2026, 11, 31, 23],
      ]) {
        const native = new Date(y, m, d, h, 30);
        const pad = (n: number) => String(n).padStart(2, '0');
        expect(LocalDate.from(nativeJs(native)).toString()).toBe(
          `${y}-${pad(m + 1)}-${pad(d)}`,
        );
      }
    });

    test('convert(LocalDate).toDate() is the local start of that day', () => {
      const js = convert(LocalDate.parse('2026-06-15')).toDate();
      expect([js.getFullYear(), js.getMonth(), js.getDate()]).toEqual([
        2026, 5, 15,
      ]);
      const prev = new Date(js.getTime() - 1);
      expect(prev.getDate()).toBe(14);
    });
  });
});
