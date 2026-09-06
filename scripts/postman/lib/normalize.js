function normalizeServerPath(routePath) {
  return routePath
    .split('/')
    .filter(Boolean)
    .map((seg) => (seg.startsWith(':') ? '{param}' : seg))
    .join('/');
}

function normalizeCollectionPath(pathSegments) {
  return (pathSegments || [])
    .map((seg) => String(seg))
    .filter((seg) => seg && seg !== '/')
    .map((seg) => (/^\{\{.*\}\}$/.test(seg) ? '{param}' : seg))
    .join('/');
}

function bodyModeOf(request) {
  const body = request && request.body;
  return body && body.mode ? String(body.mode) : 'none';
}

function compareRoutes(serverRoutes, collectionRequests) {
  const serverByPath = new Map();
  for (const route of serverRoutes) {
    const key = normalizeServerPath(route.path);
    if (!serverByPath.has(key)) serverByPath.set(key, new Set());
    serverByPath.get(key).add(route.method);
  }

  const normalizedRequests = collectionRequests.map((req) => ({
    method: req.method,
    path: normalizeCollectionPath(req.pathSegments),
    bodyMode: bodyModeOf(req.request),
    name: req.name,
  }));

  const missing = [];
  for (const route of serverRoutes) {
    const key = normalizeServerPath(route.path);
    const hasMatch = normalizedRequests.some(
      (req) => req.method === route.method && req.path === key
    );
    if (!hasMatch) missing.push(route);
  }

  const extra = [];
  const mismatched = [];
  const duplicateGroups = [];
  const seenByDupKey = new Map();

  for (const req of normalizedRequests) {
    const methods = serverByPath.get(req.path);
    if (!methods) {
      extra.push(req);
      continue;
    }
    if (!methods.has(req.method)) {
      mismatched.push(req);
      continue;
    }
    const dupKey = `${req.method} ${req.path} | body-mode:${req.bodyMode}`;
    if (seenByDupKey.has(dupKey)) {
      seenByDupKey.get(dupKey).push(req);
    } else {
      seenByDupKey.set(dupKey, [req]);
    }
  }
  for (const group of seenByDupKey.values()) {
    if (group.length > 1) duplicateGroups.push(group);
  }

  return { missing, extra, mismatched, duplicates: duplicateGroups };
}

module.exports = { normalizeServerPath, normalizeCollectionPath, compareRoutes, bodyModeOf };
