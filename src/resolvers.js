import { GraphQLScalarType, Kind } from 'graphql';
import { datasource as data } from './jsonData.js';

/* ------------------------------------------------------------------ *
 * Custom scalars
 * ------------------------------------------------------------------ */

/**
 * Long: 64-bit integer timestamp.
 * Values in the dataset are millisecond epochs (e.g. 1654046260304) which fit
 * comfortably inside JS Number's safe integer range, so we store/return them
 * as Numbers rather than BigInt.
 */
const LongScalar = new GraphQLScalarType({
  name: 'Long',
  description: '64-bit integer (timestamp)',
  serialize(value) {
    return Number(value);
  },
  parseValue(value) {
    return Number(value);
  },
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) return parseInt(ast.value, 10);
    if (ast.kind === Kind.STRING) return Number(ast.value);
    return null;
  },
});

/**
 * JSON: arbitrary JSON value (ResourceTemplate.schema, ResponseVariation.responses).
 * Queries only read JSON (serialize); parse paths are provided for completeness.
 */
const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize(value) {
    return value;
  },
  parseValue(value) {
    return value;
  },
  parseLiteral(ast) {
    switch (ast.kind) {
      case Kind.STRING:
      case Kind.BOOLEAN:
        return ast.value;
      case Kind.INT:
        return parseInt(ast.value, 10);
      case Kind.FLOAT:
        return parseFloat(ast.value);
      case Kind.OBJECT: {
        const obj = Object.create(null);
        for (const field of ast.fields) {
          obj[field.name.value] = JSONScalar.parseLiteral(field.value);
        }
        return obj;
      }
      case Kind.LIST:
        return ast.values.map((v) => JSONScalar.parseLiteral(v));
      case Kind.NULL:
        return null;
      default:
        return null;
    }
  },
});

/* ------------------------------------------------------------------ *
 * Helpers
 * ------------------------------------------------------------------ */

const lookupAll = (ids, map) => {
  if (!Array.isArray(ids)) return [];
  return ids.map((id) => map.get(id)).filter(Boolean);
};

const asArray = (v) => (Array.isArray(v) ? v : []);

/* ------------------------------------------------------------------ *
 * Resolvers
 * ------------------------------------------------------------------ */

export const resolvers = {
  Long: LongScalar,
  JSON: JSONScalar,

  Query: {
    node: (_parent, { nodeId }) => {
      if (nodeId == null) return null;
      // Accept either the document _id or its compositeId.
      return data.nodesById.get(nodeId) || data.nodesByCompositeId.get(nodeId) || null;
    },

    // --- top-level entry points for the other collections ---
    nodes: () => data.nodes,

    trigger: (_parent, { id }) =>
      id == null ? null : data.triggersById.get(id) || null,

    action: (_parent, { id }) =>
      id == null ? null : data.actionsById.get(id) || null,

    response: (_parent, { id }) =>
      id == null ? null : data.responsesById.get(id) || null,

    resourceTemplate: (_parent, { id }) =>
      id == null ? null : data.resourceTemplatesById.get(id) || null,
  },

  NodeObject: {
    // --- cross-file associations (the JSON stores IDs, not objects) ---
    trigger: (parent) =>
      parent.trigger ? data.triggersById.get(parent.trigger) || null : null,
    triggerId: (parent) => parent.trigger || null,

    responses: (parent) => lookupAll(parent.responses, data.responsesById),
    responseIds: (parent) => asArray(parent.responses),

    // node.json stores action references under `postActions` (and `preActions`,
    // which is always null in the dataset); map them onto the schema's
    // `actions` / `actionIds`.
    actions: (parent) =>
      lookupAll(parent.postActions || parent.actions, data.actionsById),
    actionIds: (parent) =>
      asArray(parent.postActions || parent.actions),

    // `parents` stores compositeIds, not _ids. Resolve to full NodeObjects and
    // derive their real _ids for `parentIds`.
    parents: (parent) => {
      const parents = asArray(parent.parents);
      return parents
        .map((cid) => data.nodesByCompositeId.get(cid))
        .filter(Boolean);
    },
    parentIds: (parent) => {
      const parents = asArray(parent.parents);
      return parents
        .map((cid) => data.nodesByCompositeId.get(cid))
        .filter(Boolean)
        .map((n) => n._id);
    },

    // Fields that exist directly on the source object fall through to the
    // default resolver; nothing else to do here.
  },

  Trigger: {
    resourceTemplate: (parent) =>
      parent.resourceTemplateId
        ? data.resourceTemplatesById.get(parent.resourceTemplateId) || null
        : null,
  },

  Action: {
    resourceTemplate: (parent) =>
      parent.resourceTemplateId
        ? data.resourceTemplatesById.get(parent.resourceTemplateId) || null
        : null,
  },

  ResponseLocaleGroup: {
    // response.json uses `localeGroup` (a string); schema calls it `localeGroupId`.
    localeGroupId: (parent) => parent.localeGroup ?? null,
  },

  ResourceTemplate: {
    // Some templates in the dataset omit createdAt (only updatedAt present) but
    // the schema marks it non-null, so default to 0 when missing.
    createdAt: (parent) =>
      parent.createdAt != null ? parent.createdAt : 0,
  },
};
