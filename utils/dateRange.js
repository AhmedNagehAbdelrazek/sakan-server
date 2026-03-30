const ApiError = require('./ApiError');

function parseDateOrThrow(value, fieldName) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw new ApiError(`Invalid ${fieldName} date`, 400);
  }
  return parsed;
}

function resolveDateRange({
  from,
  to,
  defaultDays = 30,
  now = new Date(),
  applyDefault = true,
} = {}) {
  if (!Number.isFinite(defaultDays) || defaultDays <= 0) {
    throw new ApiError('defaultDays must be a positive number', 400);
  }

  const end = to ? parseDateOrThrow(to, 'to') : (applyDefault ? new Date(now) : null);
  const start = from
    ? parseDateOrThrow(from, 'from')
    : ((applyDefault && end)
      ? new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000)
      : null);

  if (start && end && start.getTime() > end.getTime()) {
    throw new ApiError('`from` must be less than or equal to `to`', 400);
  }

  return {
    from: start,
    to: end,
  };
}

module.exports = {
  parseDateOrThrow,
  resolveDateRange,
};
