/**
 * GraphQL type definitions for the coding test, provided as a plain SDL string
 * (Apollo Server accepts a string for `typeDefs`).
 *
 * Two non-standard scalars are used by the provided schema and must be
 * supplied separately (see resolvers.js):
 *   - Long : 64-bit integer timestamp (values here fit in JS Number range)
 *   - JSON : arbitrary JSON value (used by ResourceTemplate.schema and
 *            ResponseVariation.responses)
 */
export const typeDefs = `
  scalar Long
  scalar JSON

  type Action {
    _id: ID!
    createdAt: Long!
    updatedAt: Long
    name: String!
    description: String
    functionString: String
    resourceTemplateId: ID
    resourceTemplate: ResourceTemplate
  }

  type Trigger {
    _id: ID!
    createdAt: Long!
    updatedAt: Long
    name: String!
    description: String
    functionString: String
    resourceTemplateId: ID
    resourceTemplate: ResourceTemplate
  }

  type Response {
    _id: ID!
    createdAt: Long!
    updatedAt: Long
    name: String!
    description: String
    platforms: [ResponsePlatform]
  }

  type ResponsePlatform {
    integrationId: ID
    build: Int
    localeGroups: [ResponseLocaleGroup]
  }

  type ResponseLocaleGroup {
    localeGroupId: ID
    variations: [ResponseVariation]
  }

  type ResponseVariation {
    name: String!
    responses: JSON
  }

  type ResourceTemplate {
    _id: ID!
    createdAt: Long!
    updatedAt: Long
    name: String!
    description: String
    schema: JSON
    integrationId: String
    functionString: String
    key: String
  }

  type NodeObject {
    _id: ID!
    createdAt: Long!
    updatedAt: Long
    name: String!
    description: String
    parents: [NodeObject]
    parentIds: [ID]
    root: Boolean
    trigger: Trigger
    triggerId: ID
    responses: [Response]
    responseIds: [ID]
    actions: [Action]
    actionIds: [ID]
    priority: Float
    compositeId: ID
    global: Boolean
    colour: String
  }

  type Query {
    node(nodeId: ID): NodeObject
    nodes: [NodeObject!]!
    trigger(id: ID): Trigger
    action(id: ID): Action
    response(id: ID): Response
    resourceTemplate(id: ID): ResourceTemplate
  }
`;
