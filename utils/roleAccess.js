const MUTATE_ROLES = ['admin', 'super_admin'];
const OVERSEE_ROLES = ['admin', 'super_admin', 'manager'];

function canMutate(role) {
  return MUTATE_ROLES.includes(role);
}

function canOversee(role) {
  return OVERSEE_ROLES.includes(role);
}

module.exports = { canMutate, canOversee };
