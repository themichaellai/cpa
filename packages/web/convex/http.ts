import { z } from 'zod';
import { httpRouter } from 'convex/server';
import { httpAction, query } from './_generated/server';
import { internal, api } from './_generated/api';

const http = httpRouter();

const pullSchema = z.object({
  profileID: z.string(),
  clientGroupID: z.string(),
  cookie: z.union([z.null(), z.number()]),
  schemaVersion: z.string(),
});

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'http://localhost:3000',
  'Access-Control-Allow-Methods': 'POST',
  'Access-Control-Allow-Headers': '*',
};

const invalidRequestResponse = (errorMessage: string | null) =>
  new Response(
    JSON.stringify({
      error: errorMessage ?? 'invalid request',
    }),
    {
      status: 400,
      headers: {
        ...CORS_HEADERS,
        'content-type': 'application/json',
      },
    },
  );

http.route({
  path: '/pull',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, req) => {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }),
});

const parseUserKeyFromHeader = (authHeader: string | null): string | null => {
  if (authHeader == null) {
    return null;
  }
  const match = authHeader.match(/^Bearer (.+)$/);
  if (match == null) {
    return null;
  }
  return match[1];
};

http.route({
  path: '/pull',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const reqBodyParsed = pullSchema.safeParse(await req.json());
    if (!reqBodyParsed.success) {
      return invalidRequestResponse(JSON.parse(reqBodyParsed.error.message));
    }
    const authHeader = req.headers.get('authorization');
    if (authHeader == null) {
      return invalidRequestResponse('missing user key');
    }
    const userKey = parseUserKeyFromHeader(authHeader);
    if (userKey == null) {
      return invalidRequestResponse('invalid user key');
    }
    const reqBody = reqBodyParsed.data;
    const res = await ctx.runMutation(api.tasks.pull, {
      clientGroupId: reqBody.clientGroupID,
      cookie: reqBody.cookie,
      profileId: reqBody.profileID,
      schemaVersion: reqBody.schemaVersion,
      userKey,
    });
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'content-type': 'application/json',
      },
    });
  }),
});

http.route({
  path: '/push',
  method: 'OPTIONS',
  handler: httpAction(async (ctx, req) => {
    return new Response(null, {
      headers: CORS_HEADERS,
    });
  }),
});

http.route({
  path: '/push',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    // TODO: validate
    const authHeader = req.headers.get('authorization');
    if (authHeader == null) {
      return invalidRequestResponse('missing user key');
    }
    const userKey = parseUserKeyFromHeader(authHeader);
    if (userKey == null) {
      return invalidRequestResponse('invalid user key');
    }
    const reqBody = await req.json();
    const res = await ctx.runMutation(api.tasks.push, {
      pushVersion: reqBody.pushVersion,
      profileId: reqBody.profileID,
      clientGroupId: reqBody.clientGroupID,
      mutations: reqBody.mutations,
      userKey,
    });
    return new Response(JSON.stringify(res), {
      status: 200,
      headers: {
        ...CORS_HEADERS,
        'content-type': 'application/json',
      },
    });
  }),
});

// Convex expects the router to be the default export of `convex/http.js`.
export default http;
