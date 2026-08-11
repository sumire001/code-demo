import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..');

function loadJson(name) {
  const raw = readFileSync(join(dataDir, name), 'utf-8');
  return JSON.parse(raw);
}

/**
 * In-memory datasource built from the provided JSON files.
 *
 * Each collection is exposed both as a raw array and as a Map keyed by `_id`
 * for O(1) lookups. NodeObjects additionally get a compositeId index because
 * the `parents` field references parents by `compositeId`, not `_id`.
 */
function indexById(items) {
  const map = new Map();
  for (const item of items) {
    if (item && item._id != null) map.set(item._id, item);
  }
  return map;
}

function indexByComposite(items) {
  const map = new Map();
  for (const item of items) {
    if (item && item.compositeId != null) map.set(item.compositeId, item);
  }
  return map;
}

export const datasource = (() => {
  const nodes = loadJson('node.json');
  const actions = loadJson('action.json');
  const triggers = loadJson('trigger.json');
  const responses = loadJson('response.json');
  const resourceTemplates = loadJson('resourceTemplate.json');

  return {
    nodes,
    actions,
    triggers,
    responses,
    resourceTemplates,

    nodesById: indexById(nodes),
    nodesByCompositeId: indexByComposite(nodes),
    actionsById: indexById(actions),
    triggersById: indexById(triggers),
    responsesById: indexById(responses),
    resourceTemplatesById: indexById(resourceTemplates),
  };
})();
