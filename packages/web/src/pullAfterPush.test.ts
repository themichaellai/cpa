import { describe, expect, test } from 'bun:test';
import type { PushRequest, Pusher, PusherResult } from 'replicache';

import { pullAfterPush } from './pullAfterPush';

const req = {} as PushRequest;

const resultWith = (status: number): PusherResult => ({
  httpRequestInfo: { httpStatusCode: status, errorMessage: '' },
});

/** A fake rep whose pusher runs `push` and which counts pulls. */
const fakeRep = (
  push: Pusher,
  pull: () => Promise<void> = () => Promise.resolve(),
) => {
  let pulls = 0;
  const rep = {
    pusher: push,
    pull: () => {
      pulls++;
      return pull();
    },
  };
  pullAfterPush(rep);
  return { rep, pulls: () => pulls };
};

describe('pullAfterPush', () => {
  test('pulls after a successful push and passes its result through', async () => {
    const result = resultWith(200);
    let pushedWith: unknown[] = [];
    const { rep, pulls } = fakeRep(async (...args) => {
      pushedWith = args;
      return result;
    });
    expect(await rep.pusher(req, 'r1')).toBe(result);
    expect(pushedWith).toEqual([req, 'r1']);
    expect(pulls()).toBe(1);
  });

  test.each([401, 500])("doesn't pull after a %d", async (status) => {
    const { rep, pulls } = fakeRep(async () => resultWith(status));
    await rep.pusher(req, 'r1');
    expect(pulls()).toBe(0);
  });

  test("a failing pull doesn't fail the push", async () => {
    const result = resultWith(200);
    const { rep } = fakeRep(
      async () => result,
      () => Promise.reject(new Error('closed')),
    );
    expect(await rep.pusher(req, 'r1')).toBe(result);
  });

  test('a push that throws still throws, without pulling', async () => {
    const { rep, pulls } = fakeRep(async () => {
      throw new Error('offline');
    });
    await expect(rep.pusher(req, 'r1')).rejects.toThrow('offline');
    expect(pulls()).toBe(0);
  });
});
