# Backend Engineer Code Test — GraphQL API Server

A GraphQL API server (Node.js + Apollo Server v4) that serves the provided schema
from the supplied JSON files as the datasource, protected by Bearer-token auth.

## Requirements covered

- **Language:** Node.js (ESM, >= 18)
- **Library:** Apollo Server v4 (`@apollo/server`)
- **Schema:** the provided SDL (8 types + `Query.node`) plus top-level list/by-id
  entry points for the other collections
- **Datasource:** the provided `node.json`, `action.json`, `trigger.json`,
  `response.json`, `resourceTemplate.json`
- **Auth:** Bearer token required on every request (rejected with HTTP 401 otherwise)

## Project layout

```
.
├── action.json               # datasource: Action
├── trigger.json              # datasource: Trigger
├── response.json             # datasource: Response (4-level nesting)
├── resourceTemplate.json     # datasource: ResourceTemplate
├── node.json                 # datasource: NodeObject
├── src/
│   ├── index.js              # Apollo Server entry + Bearer auth plugin
│   ├── schema.js             # typeDefs (Long / JSON custom scalars)
│   ├── resolvers.js          # resolvers + custom scalars
│   ├── jsonData.js           # loads JSON, builds lookup indexes
│   └── auth.js               # Bearer token validation
├── package.json
├── README.md                 # this file (English)
└── README_CN.md              # Chinese version
```

## Setup

```bash
npm install
npm start
```

Or simply run the provided startup script (auto-installs deps, then starts the server):

```bash
./start.sh            # Git Bash / Linux / macOS
# or on Windows cmd:
start.bat
```

The server listens on `http://localhost:4000/` by default (override with `PORT`).

## Testing

A Jest smoke test (`tests/server.test.js`) spawns the real server entrypoint, then
exercises the full HTTP stack — including the Bearer-token 401 path — over HTTP:

```bash
npm test
```

It covers: auth rejection (401) / acceptance (200), nested `node` resolution
(trigger → resourceTemplate, responses, actions, parents via compositeId),
data-mapping edge cases (`createdAt` default, `localeGroup` → `localeGroupId`,
`postActions` → `actions`), and the top-level entry points.

## Authentication

Every request must include:

```
Authorization: Bearer test-bearer-token-woztell-2026
```

Requests without a valid token are rejected with **HTTP 401** (`UNAUTHENTICATED`).
Introspection and all operations are protected by the same check.

> **Submission token:** `test-bearer-token-woztell-2026`

## Schema overview

8 types plus a `Query` type. `NodeObject` is the hub — every other type is reached
through it (and, for convenience, through the top-level entry points below).

```
Query
 ├─ node(nodeId: ID): NodeObject
 ├─ nodes: [NodeObject!]!
 ├─ trigger(id: ID): Trigger
 ├─ action(id: ID): Action
 ├─ response(id: ID): Response
 └─ resourceTemplate(id: ID): ResourceTemplate

NodeObject ──> Trigger ──> ResourceTemplate
NodeObject ──> [Response] ──> [ResponsePlatform] ──> [ResponseLocaleGroup] ──> [ResponseVariation]
NodeObject ──> [Action] ──> ResourceTemplate
NodeObject ──> [NodeObject]   (parents, self-reference via compositeId)
```

Two non-standard scalars are implemented as custom scalars in `src/resolvers.js`:
- `Long` — 64-bit integer timestamp (e.g. `1654046260304`)
- `JSON` — arbitrary JSON value (e.g. `ResourceTemplate.schema`, `ResponseVariation.responses`)

## Query entry points

### Via `node` (the original entry point)

```graphql
query {
  node(nodeId: "6297164810f52524ba1a9300") {
    _id
    name
    root
    trigger { name resourceTemplate { key } }
    responses { name platforms { build } }
    actions { name resourceTemplate { name } }
    parents { name compositeId }
    parentIds
  }
}
```

### Top-level entry points (added for convenience)

In addition to `node(nodeId)`, every collection can be queried directly:

```graphql
# List every node
{ nodes { _id name root } }

# Fetch any single record by its _id
{ trigger(id: "629712b210f525845e1a92f8") { name resourceTemplate { key } } }
{ action(id: "6530933e6a1690d2f0c78a92") { name resourceTemplate { name } } }
{ response(id: "6296fcad70a0c11ddb89ccf0") { name platforms { integrationId } } }
{ resourceTemplate(id: "61e9ba20f9b58155162dbf52") { name key createdAt } }
```

All still require the Bearer token. Unknown ids return `null`.

With curl:

```bash
curl -X POST http://localhost:4000/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-bearer-token-woztell-2026" \
  -d '{"query":"{ node(nodeId:\"6297164810f52524ba1a9300\"){ name root trigger{name} responses{name} } }"}'
```

## Data mapping notes

The JSON datasource does not map 1:1 onto the schema; resolvers bridge the gaps:

| Concern | Handling |
| --- | --- |
| `NodeObject.parents` | Stored as `compositeId`s — resolved to full `NodeObject`s; `parentIds` derives their real `_id`s. |
| `NodeObject.trigger` / `responses` / `actions` | Stored as `_id`s — resolved by cross-file lookup. `postActions` maps to `actions`/`actionIds`. |
| `Trigger` / `Action.resourceTemplate` | Resolved by `resourceTemplateId`. |
| `ResponseLocaleGroup.localeGroupId` | Mapped from `response.json`'s `localeGroup` string. |
| `ResourceTemplate.createdAt` | Schema marks it non-null; some records omit it, so it defaults to `0`. |
| `Trigger.updatedAt` | Optional; absent records return `null`. |
| `Long` / `JSON` scalars | Implemented as custom scalars (`src/resolvers.js`). |

## Test data (real `_id` values)

- Nodes: `6296be3470a0c1052f89cccb` (Greeting Message, root), `6297164810f52524ba1a9300` (Sign up Webinar) ...
- Trigger: `629712b210f525845e1a92f8` (Keyword: Say Hi)
- Action: `6530933e6a1690d2f0c78a92` (Send Email Action)
- Response: `6296fcad70a0c11ddb89ccf0` (Greeting Message)
- ResourceTemplate: `61e9ba20f9b58155162dbf52` (Predefined Triggers)
