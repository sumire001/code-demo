/**
 * Smoke test for the GraphQL API server.
 *
 * Strategy: spawn the real entrypoint (`node src/index.js`) as a child process,
 * parse the listening URL from its stdout, then exercise the API over HTTP.
 * This exercises the full stack — including the Bearer-token auth plugin that
 * returns HTTP 401.
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const TOKEN = 'test-bearer-token-woztell-2026';

let child;
let baseUrl;

async function gql(query, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(baseUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ query }),
  });
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: ROOT,
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  baseUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Server did not become ready in time')),
      15000
    );
    child.stdout.on('data', (chunk) => {
      const m = chunk.toString().match(/http:\/\/localhost:(\d+)\//);
      if (m) {
        clearTimeout(timer);
        resolve(`http://localhost:${m[1]}/`);
      }
    });
    child.stderr.on('data', () => {});
  });
}, 20000);

afterAll(() => {
  if (child) child.kill();
});

describe('Auth', () => {
  test('rejects requests without a token (HTTP 401)', async () => {
    const { status } = await gql(
      '{ node(nodeId: "6297164810f52524ba1a9300") { name } }',
      null
    );
    expect(status).toBe(401);
  });

  test('rejects requests with a wrong token (HTTP 401)', async () => {
    const { status } = await gql(
      '{ node(nodeId: "6297164810f52524ba1a9300") { name } }',
      'wrong-token'
    );
    expect(status).toBe(401);
  });

  test('accepts requests with the valid token (HTTP 200)', async () => {
    const { status } = await gql(
      '{ node(nodeId: "6297164810f52524ba1a9300") { name } }',
      TOKEN
    );
    expect(status).toBe(200);
  });
});

describe('Query.node — nested resolution', () => {
  test('resolves trigger -> resourceTemplate, responses, actions, parents', async () => {
    const q = `{
      node(nodeId: "6297164810f52524ba1a9300") {
        name
        trigger { name resourceTemplate { key name } }
        responses { name }
        actions { name }
        parents { name compositeId }
        parentIds
      }
    }`;
    const { status, body } = await gql(q, TOKEN);
    expect(status).toBe(200);
    expect(body.errors).toBeUndefined();
    const node = body.data.node;
    expect(node.name).toBe('Sign up Webinar');
    expect(node.trigger.resourceTemplate.key).toBe('keyword-payload');
    expect(node.responses).toHaveLength(1);
    expect(node.responses[0].name).toBe('Ask for Email');
    expect(node.actions).toEqual([]);
    expect(node.parents[0].name).toBe('Greeting Message');
    expect(node.parentIds).toContain('6296be3470a0c1052f89cccb');
  });

  test('parents are resolved via compositeId (root node has none)', async () => {
    const { body } = await gql(
      '{ node(nodeId: "6296be3470a0c1052f89cccb") { name root parents { name } } }',
      TOKEN
    );
    const node = body.data.node;
    expect(node.root).toBe(true);
    expect(node.parents).toEqual([]);
  });

  test('unknown nodeId returns null', async () => {
    const { body } = await gql(
      '{ node(nodeId: "no-such-id") { name } }',
      TOKEN
    );
    expect(body.data.node).toBeNull();
  });
});

describe('Data mapping', () => {
  test('ResourceTemplate.createdAt defaults to 0 when missing in source', async () => {
    const { body } = await gql(
      '{ resourceTemplate(id: "61e9ba20f9b58155162dbf52") { name createdAt } }',
      TOKEN
    );
    expect(body.data.resourceTemplate.createdAt).toBe(0);
  });

  test('localeGroup (JSON) maps to localeGroupId (schema)', async () => {
    const { body } = await gql(
      '{ response(id: "6296fcad70a0c11ddb89ccf0") { platforms { localeGroups { localeGroupId } } } }',
      TOKEN
    );
    const lg = body.data.response.platforms[0].localeGroups[0];
    expect(lg.localeGroupId).toBe('default');
  });

  test('postActions (JSON) maps to actions (schema)', async () => {
    const { body } = await gql(
      '{ node(nodeId: "6297172e70a0c165b989cd10") { actions { name } } }',
      TOKEN
    );
    expect(body.data.node.actions[0].name).toBe('Send Email Action');
  });
});

describe('Top-level entry points (additions)', () => {
  test('nodes lists all 7 records', async () => {
    const { body } = await gql('{ nodes { _id name } }', TOKEN);
    expect(body.data.nodes).toHaveLength(7);
  });

  test('trigger / action / response by id resolve', async () => {
    const q = `{
      trigger(id: "629712b210f525845e1a92f8") { name }
      action(id: "6530933e6a1690d2f0c78a92") { name }
      response(id: "6296fcad70a0c11ddb89ccf0") { name }
    }`;
    const { body } = await gql(q, TOKEN);
    expect(body.data.trigger.name).toBe('Keyword: Say Hi');
    expect(body.data.action.name).toBe('Send Email Action');
    expect(body.data.response.name).toBe('Greeting Message');
  });
});
