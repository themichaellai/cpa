import type { Pusher } from 'replicache';

/**
 * Replicache only confirms a mutation when a pull sees the server's
 * lastMutationID, and it doesn't pull after a push. Without this, edits stay
 * "waiting to sync" until the next interval pull (up to 20s).
 */
export const pullAfterPush = (rep: {
  pusher: Pusher;
  pull: () => Promise<void>;
}) => {
  const defaultPusher = rep.pusher;
  rep.pusher = async (req, requestID) => {
    const result = await defaultPusher(req, requestID);
    const allMutationsApplied = result.httpRequestInfo.httpStatusCode === 200;
    if (allMutationsApplied) {
      // Not awaited, so the push doesn't wait on the pull.
      rep.pull().catch(() => {});
    }
    return result;
  };
};
