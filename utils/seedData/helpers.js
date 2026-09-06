const crypto = require('crypto');

const SEED_PASSWORD = 'Password123!';

const SEED_NAMESPACES = {
  user: 'sakan-seed:user',
  profile: 'sakan-seed:user_profile',
  preference: 'sakan-seed:user_preference',
  property: 'sakan-seed:property',
  application: 'sakan-seed:application',
  payment: 'sakan-seed:payment',
  flatmateRequest: 'sakan-seed:flatmate_request',
  joinInterest: 'sakan-seed:join_interest',
  propertyRequest: 'sakan-seed:property_request',
  chat: 'sakan-seed:chat',
  message: 'sakan-seed:message',
};

function uuid5(name, namespace) {
  const hex = crypto
    .createHash('sha256')
    .update(`${namespace}:${name}`)
    .digest('hex')
    .slice(0, 32);

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `5${hex.slice(13, 16)}`,
    `8${hex.slice(17, 20)}`,
    hex.slice(20, 32),
  ].join('-');
}

const uuids = {};
for (const [kind, namespace] of Object.entries(SEED_NAMESPACES)) {
  uuids[kind] = (key) => uuid5(key, namespace);
}

async function upsertByKey(Model, keyName, keyValue, data, { excludeOnUpdate = [] } = {}) {
  const existing = await Model.findOne({ where: { [keyName]: keyValue } });

  if (!existing) {
    await Model.create(data);
    return;
  }

  const payload = { ...data };
  for (const key of [...excludeOnUpdate, keyName, 'id']) {
    delete payload[key];
  }

  if (Object.keys(payload).length > 0) {
    await existing.update(payload);
  }
}

async function findOrCreate(Model, where, data) {
  const existing = await Model.findOne({ where });
  if (existing) return existing;
  return Model.create(data);
}

const DAY_MS = 24 * 60 * 60 * 1000;
const daysAgo = (n) => new Date(Date.now() - n * DAY_MS);
const daysFromNow = (n) => new Date(Date.now() + n * DAY_MS);

module.exports = {
  SEED_PASSWORD,
  uuids,
  upsertByKey,
  findOrCreate,
  daysAgo,
  daysFromNow,
};
