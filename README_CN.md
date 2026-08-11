# 后端工程师编码测试 — GraphQL API 服务

基于 Node.js + Apollo Server v4 实现的 GraphQL API 服务。以提供的 JSON 文件作为数据源，
对外提供题目给定的 Schema，并使用 Bearer Token 进行认证保护。

## 已实现的需求

- **语言：** Node.js（ESM 模块，>= 18）
- **框架：** Apollo Server v4（`@apollo/server`）
- **Schema：** 题目给定的 SDL（8 个类型 + `Query.node`），并为其余数据集合补充了顶层列表/按 id 查询入口
- **数据源：** 提供的 `node.json`、`action.json`、`trigger.json`、`response.json`、`resourceTemplate.json`
- **认证：** 每个请求都必须携带 Bearer Token，否则返回 HTTP 401

## 项目结构

```
.
├── action.json               # 数据源：Action（动作）
├── trigger.json              # 数据源：Trigger（触发器）
├── response.json             # 数据源：Response（响应，4 层嵌套）
├── resourceTemplate.json     # 数据源：ResourceTemplate（资源模板）
├── node.json                 # 数据源：NodeObject（节点，核心实体）
├── src/
│   ├── index.js              # Apollo Server 启动入口 + Bearer 认证插件
│   ├── schema.js             # 类型定义（含自定义 Long / JSON 标量）
│   ├── resolvers.js          # Resolver + 自定义标量
│   ├── jsonData.js           # 加载 JSON 并构建查询索引
│   └── auth.js               # Bearer Token 校验
├── package.json
├── README.md                 # 英文说明文档
└── README_CN.md              # 本文件（中文）
```

## 启动方式

```bash
npm install
npm start
```

或直接运行随附的启动脚本（自动安装依赖后启动服务）：

```bash
./start.sh            # Git Bash / Linux / macOS
# 或在 Windows cmd 中：
start.bat
```

默认监听 `http://localhost:4000/`（可用环境变量 `PORT` 覆盖端口）。

## 测试

Jest 冒烟测试（`tests/server.test.js`）会启动真实的服务器入口，然后通过 HTTP 调
用完整链路——包括 Bearer Token 的 401 认证路径：

```bash
npm test
```

覆盖内容：认证拒绝（401）/ 通过（200）、`node` 的嵌套解析（trigger → resourceTemplate、
responses、actions、通过 compositeId 解析 parents）、数据映射边界情况
（`createdAt` 默认值、`localeGroup` → `localeGroupId`、`postActions` → `actions`），
以及顶层查询入口。

## 认证说明

每个请求都必须包含如下请求头：

```
Authorization: Bearer test-bearer-token-woztell-2026
```

未携带有效 Token 的请求会被拒绝，返回 **HTTP 401**（`UNAUTHENTICATED`）。
包括 introspection（自省）在内的所有操作都受同一校验保护。

> **提交用 Token：** `test-bearer-token-woztell-2026`

## Schema 结构概览

共 8 个类型加一个 `Query` 类型。`NodeObject` 是数据枢纽——其余类型都通过它关联访问
（并且，为方便使用，也提供了下方独立的顶层查询入口）。

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
NodeObject ──> [NodeObject]   （parents，通过 compositeId 自引用）
```

Schema 中使用了两个非标准标量，已在 `src/resolvers.js` 中自定义实现：
- `Long` — 64 位整数时间戳（例如 `1654046260304`）
- `JSON` — 任意 JSON 结构（例如 `ResourceTemplate.schema`、`ResponseVariation.responses`）

## 查询入口

### 通过 `node`（原始入口）

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

### 顶层查询入口（为方便使用而补充）

除 `node(nodeId)` 外，也可以直接查询任意数据集合：

```graphql
# 列出全部节点
{ nodes { _id name root } }

# 按 _id 直接查询单条记录
{ trigger(id: "629712b210f525845e1a92f8") { name resourceTemplate { key } } }
{ action(id: "6530933e6a1690d2f0c78a92") { name resourceTemplate { name } } }
{ response(id: "6296fcad70a0c11ddb89ccf0") { name platforms { integrationId } } }
{ resourceTemplate(id: "61e9ba20f9b58155162dbf52") { name key createdAt } }
```

以上查询同样需要携带 Bearer Token。查询不存在的 id 时返回 `null`。

使用 curl 调用：

```bash
curl -X POST http://localhost:4000/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-bearer-token-woztell-2026" \
  -d '{"query":"{ node(nodeId:\"6297164810f52524ba1a9300\"){ name root trigger{name} responses{name} } }"}'
```

## 数据映射说明

JSON 数据源与 Schema 并非一一对应，由 Resolver 进行桥接处理：

| 问题点 | 处理方式 |
| --- | --- |
| `NodeObject.parents` | 实际存储的是 `compositeId` —— 解析为完整的 `NodeObject`；`parentIds` 由这些节点推导出真实的 `_id` |
| `NodeObject.trigger` / `responses` / `actions` | 实际存储的是 `_id` —— 通过跨文件查找解析；其中 `postActions` 映射到 `actions` / `actionIds` |
| `Trigger` / `Action.resourceTemplate` | 通过 `resourceTemplateId` 解析 |
| `ResponseLocaleGroup.localeGroupId` | 由 `response.json` 中的 `localeGroup` 字段映射而来 |
| `ResourceTemplate.createdAt` | Schema 标记为必填，但部分记录缺失 —— 默认返回 `0` |
| `Trigger.updatedAt` | 可选字段，缺失时返回 `null` |
| `Long` / `JSON` 标量 | 在 `src/resolvers.js` 中作为自定义标量实现 |

## 测试数据（真实 `_id` 值）

- 节点 Node： `6296be3470a0c1052f89cccb`（Greeting Message，根节点）、`6297164810f52524ba1a9300`（Sign up Webinar）等
- 触发器 Trigger： `629712b210f525845e1a92f8`（Keyword: Say Hi）
- 动作 Action： `6530933e6a1690d2f0c78a92`（Send Email Action）
- 响应 Response： `6296fcad70a0c11ddb89ccf0`（Greeting Message）
- 资源模板 ResourceTemplate： `61e9ba20f9b58155162dbf52`（Predefined Triggers）
