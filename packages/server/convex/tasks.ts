import { query, mutation, MutationCtx, QueryCtx } from './_generated/server';
import { Id, DataModel } from './_generated/dataModel';
import { v } from 'convex/values';
import { MutationV1, PushRequestV1 } from 'replicache';

const mutationCommon = {
  id: v.number(),
  timestamp: v.number(),
  clientId: v.string(),
};

const mutations = v.array(
  v.union(
    v.object({
      ...mutationCommon,
      name: v.literal('addDay'),
      args: v.object({
        date: v.string(),
      }),
    }),
    v.object({
      ...mutationCommon,
      name: v.literal('setWakeUp'),
      args: v.object({
        date: v.string(),
        wakeUp: v.union(v.null(), v.object({ time: v.string() })),
      }),
    }),
  ),
);

/** Returns null if user does not have access to the client group. */
const getOrInitializeClientGroupId = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
  spaceId: Id<'space'>,
  clientGroupId: string,
): Promise<Id<'replicacheClientGroup'> | null> => {
  const clientGroup = await ctx.db
    .query('replicacheClientGroup')
    .filter((q) =>
      q.and(
        // 2. Verify that the requesting user owns the specified
        // ReplicacheClientGroup.
        q.eq(q.field('userId'), userId),
        // 3. Verify that the ReplicacheClientGroup is in the requested space.
        q.eq(q.field('spaceId'), spaceId),
        q.eq(q.field('id'), clientGroupId),
      ),
    )
    .first();
  if (clientGroup != null) {
    if (clientGroup.userId !== userId) {
      return null;
    }
    return clientGroup._id;
  }
  return await ctx.db.insert('replicacheClientGroup', {
    userId: userId,
    spaceId: spaceId,
    id: clientGroupId,
  });
};

const getOrInitializeClient = async (
  ctx: MutationCtx,
  clientGroupId: Id<'replicacheClientGroup'>,
  clientId: string,
): Promise<Id<'replicacheClient'> | null> => {
  const client = await ctx.db
    .query('replicacheClient')
    .filter((q) =>
      q.and(
        q.eq(q.field('replicacheClientGroupId'), clientGroupId),
        q.eq(q.field('id'), clientId),
      ),
    )
    .first();
  if (client != null) {
    return client._id;
  }
  return await ctx.db.insert('replicacheClient', {
    lastModifiedVersion: 0,
    lastMutationId: 0,
    replicacheClientGroupId: clientGroupId,
    id: clientId,
  });
};

const getOrCreateClient = async (
  ctx: MutationCtx,
  clientGroupId: Id<'replicacheClientGroup'>,
  clientId: string,
): Promise<DataModel['replicacheClient']['document']> => {
  const client = await ctx.db
    .query('replicacheClient')
    .filter((q) =>
      q.and(
        q.eq(q.field('id'), clientId),
        // 4. Validate that the ReplicacheClient is part of the requested ReplicacheClientGroup.
        q.eq(q.field('replicacheClientGroupId'), clientGroupId),
      ),
    )
    .first();
  if (client != null) {
    return client;
  }
  const newClientId = await ctx.db.insert('replicacheClient', {
    id: clientId,
    lastModifiedVersion: 0,
    lastMutationId: 0,
    replicacheClientGroupId: clientGroupId,
  });
  const newClient = await ctx.db.get(newClientId);
  if (newClient == null) {
    throw new Error('failed to create new client');
  }
  return newClient;
};

/** Creates clients if they don't exist */
const getMutationIdsByClientId = async (
  ctx: MutationCtx,
  clientGroupId: Id<'replicacheClientGroup'>,
  clientIds: Array<string>,
): Promise<
  Map<string, { clientId: Id<'replicacheClient'>; mutationId: number }>
> => {
  const uniqClientIds = Array.from(new Set(clientIds));
  const clients = await Promise.all(
    uniqClientIds.map((clientId) =>
      getOrCreateClient(ctx, clientGroupId, clientId),
    ),
  );
  const mutationIdsByQueryResp = new Map(
    clients.map((r) => [
      r.id,
      { clientId: r._id, mutationId: r.lastMutationId },
    ]),
  );
  return mutationIdsByQueryResp;
};

const getOrCreateUserSpace = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<DataModel['space']['document']> => {
  const res = await ctx.db
    .query('space')
    .filter((q) => q.eq(q.field('userId'), userId))
    .first();
  if (res != null) {
    return res;
  }
  const newSpaceId = await ctx.db.insert('space', {
    userId: userId,
    version: 0,
  });
  const newSpace = await ctx.db.get(newSpaceId);
  if (newSpace == null) {
    throw new Error('failed to create new space');
  }
  return newSpace;
};

const incrementUserSpaceVersion = async (
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<number> => {
  const space = await getOrCreateUserSpace(ctx, userId);
  const newVersion = space.version + 1;
  await ctx.db.patch(space._id, {
    version: newVersion,
  });
  return newVersion;
};

export const push = mutation({
  args: {
    pushVersion: v.literal(1),
    profileId: v.string(),
    clientGroupId: v.string(),
    mutations,
    // user ID is not part of the replicache schema, figure this out
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (user == null) {
      return { error: 'user not found' };
    }
    const space = await getOrCreateUserSpace(ctx, args.userId);
    // 1. Create a new ReplicacheClientGroup if necessary.
    const clientGroupId = await getOrInitializeClientGroupId(
      ctx,
      args.userId,
      space._id,
      args.clientGroupId,
    );
    if (clientGroupId == null) {
      return { error: 'client group not found' };
    }

    const mutationIdsByClientId = await getMutationIdsByClientId(
      ctx,
      clientGroupId,
      args.mutations.map((m) => m.clientId),
    );

    for (const mutation of args.mutations) {
      // Create the ReplicacheClient if necessary.
      const lastClientMutation = mutationIdsByClientId.get(mutation.clientId);
      if (lastClientMutation == null) {
        continue;
      }
      const { clientId, mutationId: lastMutationId } = lastClientMutation;
      const nextMutationId = lastMutationId + 1;
      if (mutation.id < lastMutationId) {
        // Mutation has already been processed
        return;
      }
      // 5. Validate that the received mutation ID is the next expected
      // mutation ID from this client.
      if (mutation.id > nextMutationId) {
        throw new Error(`mutation "${mutation.id}" is from the future`);
      }
      // 6. Increment the per-space version.
      const newSpaceVersion = await incrementUserSpaceVersion(ctx, args.userId);
      // 7. Run the applicable business logic to apply the mutation.
      // - For each domain entity that is changed or deleted, update its
      //   lastModifiedVersion to the current per-space version.
      // - For each domain entity that is deleted, set its deleted field to
      //   true.
      // TODO: handle errors with mutation logic below (set last mutation IDs
      // but don't actually transform data), see `catch` block in
      // https://doc.replicache.dev/byob/remote-mutations
      switch (mutation.name) {
        case 'addDay': {
          await ctx.db.insert('days', {
            coffee: null,
            date: mutation.args.date,
            dinner: null,
            wakeUp: null,
            poops: [],
            userId: user?._id,

            lastModifiedVersion: newSpaceVersion,
            deleted: false,
          });
          break;
        }
        case 'setWakeUp': {
          break;
        }
        default: {
          const _: never = mutation;
          continue;
        }
      }
      // 8. Update the lastMutationID of the client to store that the mutation
      // was processed.
      // 9. Update the lastModifiedVersion of the client to the current
      // per-space version.
      await ctx.db.patch(clientId, {
        lastModifiedVersion: newSpaceVersion,
        lastMutationId: nextMutationId,
      });
    }
  },
});
