import type { Pusher } from 'replicache';

/**
 * Pull right after every successful push. Replicache only treats a local
 * mutation as confirmed (removing it from pendingMutations) once a pull sees
 * the server's lastMutationID, and it never pulls after a push on its own.
 * Without a server poke, that left edits "waiting to sync" until the next
 * interval pull (up to 20s). Wraps the default pusher rather than replacing
 * it, so push behaviour is unchanged. Like the interval pull, the pull waits
 * while the tab is hidden.
 *
 * Only a 200 triggers the pull: the server returns 500 if any mutation in the
 * batch fails, and then the failed one stays pending regardless. Mutation
 * recovery for other client groups also goes through this pusher, so it
 * causes one extra (harmless) pull for this client group.
 */
export const pullAfterPush = (rep: {
  pusher: Pusher;
  pull: () => Promise<void>;
}) => {
  const push = rep.pusher;
  rep.pusher = async (req, requestID) => {
    const result = await push(req, requestID);
    if (result.httpRequestInfo.httpStatusCode === 200) {
      // Not awaited: the push shouldn't wait on the pull. Pull errors are
      // already retried and reported through onSync / onOnlineChange.
      rep.pull().catch(() => {});
    }
    return result;
  };
};
