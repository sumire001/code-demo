import { ApolloServer } from '@apollo/server';
import { startStandaloneServer } from '@apollo/server/standalone';
import { GraphQLError } from 'graphql';
import { typeDefs } from './schema.js';
import { resolvers } from './resolvers.js';
import { AUTH_TOKEN, validateToken } from './auth.js';

const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

/**
 * Enforce Bearer-token auth during the operation pipeline (not in `context`).
 *
 * Throwing an `UNAUTHENTICATED` error here makes Apollo Server's built-in
 * HTTP plugin return HTTP 401 (instead of the 500 you get when throwing in
 * `context`), and protects every operation — including introspection.
 */
const authPlugin = {
  async requestDidStart() {
    return {
      async didResolveOperation({ request }) {
        const authorization = request.http?.headers?.get('authorization');
        if (!validateToken(authorization)) {
          throw new GraphQLError(
            'Unauthorized: a valid Bearer token is required',
            { extensions: { code: 'UNAUTHENTICATED' } }
          );
        }
      },
      async willSendResponse({ response }) {
        const body = response.body;
        if (!body) return;
        const errors =
          body.singleResult?.errors ||
          body.batchResult?.flatMap((r) => r.errors || []);
        if (errors?.some((e) => e.extensions?.code === 'UNAUTHENTICATED')) {
          response.http.status = 401;
        }
      },
    };
  },
};

const server = new ApolloServer({
  typeDefs,
  resolvers,
  plugins: [authPlugin],
});

const { url } = await startStandaloneServer(server, {
  listen: { port: PORT },
  context: async ({ req }) => {
    return { token: req.headers.authorization };
  },
});

console.log(`GraphQL API server ready at ${url}`);
console.log(`Authorization: Bearer ${AUTH_TOKEN}`);
