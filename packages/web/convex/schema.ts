import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  days: defineTable({
    coffee: v.union(
      v.null(),
      v.object({
        time: v.union(v.null(), v.string()),
      }),
    ),
    date: v.string(),
    dinner: v.union(
      v.null(),
      v.object({
        time: v.union(v.null(), v.string()),
        size: v.union(v.null(), v.literal('regular'), v.literal('big')),
      }),
    ),
    poops: v.array(
      v.object({
        run: v.union(v.object({ timeIntoRunMinutes: v.float64() }), v.null()),
        time: v.string(),
      }),
    ),
    wakeUp: v.union(v.null(), v.object({ time: v.string() })),

    id: v.string(),
    lastModifiedVersion: v.number(),
    deleted: v.boolean(),
    // TODO: fix this to be v.id('space')
    spaceId: v.union(v.id('space'), v.string()),
  }),
  users: defineTable({
    passwordHash: v.string(),
  }),
  space: defineTable({
    userId: v.id('users'),
    version: v.number(),
  }),
  replicacheClientGroup: defineTable({
    id: v.string(),
    userId: v.id('users'),
    spaceId: v.id('space'),
  }),
  replicacheClient: defineTable({
    id: v.string(),
    replicacheClientGroupId: v.id('replicacheClientGroup'),
    lastMutationId: v.number(),
    lastModifiedVersion: v.number(),
  }),
});
