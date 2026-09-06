const {
  normalizeServerPath,
  normalizeCollectionPath,
  compareRoutes,
  bodyModeOf,
} = require('../../scripts/postman/lib/normalize');

describe('normalizeServerPath', () => {
  it('converts :param segments to {param}', () => {
    expect(normalizeServerPath('/api/user/:id')).toBe('api/user/{param}');
  });

  it('converts multiple params', () => {
    expect(normalizeServerPath('/api/flatmate-requests/:id/join-interest')).toBe(
      'api/flatmate-requests/{param}/join-interest'
    );
  });

  it('strips leading slashes', () => {
    expect(normalizeServerPath('/api/auth/verfiyOtp')).toBe('api/auth/verfiyOtp');
  });

  it('handles a bare path', () => {
    expect(normalizeServerPath('/api/admin/dashboard')).toBe('api/admin/dashboard');
  });
});

describe('normalizeCollectionPath', () => {
  it('joins path segments', () => {
    expect(normalizeCollectionPath(['api', 'auth', 'login'])).toBe('api/auth/login');
  });

  it('converts {{var}} segments to {param}', () => {
    expect(normalizeCollectionPath(['api', 'user', '{{userId}}'])).toBe('api/user/{param}');
  });

  it('drops empty and "/" segments', () => {
    expect(normalizeCollectionPath(['api', '', '/', 'payments'])).toBe('api/payments');
  });

  it('ignores query parameters (not part of pathSegments)', () => {
    const url = { path: ['api', 'properties', 'nearby'], query: [{ key: 'lat', value: '30' }] };
    expect(normalizeCollectionPath(url.path)).toBe('api/properties/nearby');
  });
});

describe('bodyModeOf', () => {
  it('returns raw/formdata/none', () => {
    expect(bodyModeOf({ body: { mode: 'raw' } })).toBe('raw');
    expect(bodyModeOf({ body: { mode: 'formdata' } })).toBe('formdata');
    expect(bodyModeOf({ body: null })).toBe('none');
    expect(bodyModeOf(undefined)).toBe('none');
  });
});

describe('compareRoutes', () => {
  const server = (method, path) => ({ method, path });
  const req = (method, pathSegments, bodyMode, name) => ({
    method,
    pathSegments,
    request: { body: bodyMode ? { mode: bodyMode } : null },
    name: name || `${method} ${pathSegments.join('/')}`,
  });

  it('reports no gaps for an exact match', () => {
    const routes = [server('GET', '/api/user/:id'), server('POST', '/api/auth/login')];
    const requests = [req('GET', ['api', 'user', '{{userId}}']), req('POST', ['api', 'auth', 'login'])];
    const report = compareRoutes(routes, requests);
    expect(report.missing).toHaveLength(0);
    expect(report.extra).toHaveLength(0);
    expect(report.mismatched).toHaveLength(0);
    expect(report.duplicates).toHaveLength(0);
  });

  it('reports missing server routes', () => {
    const routes = [server('GET', '/api/properties'), server('DELETE', '/api/property-requests/:id')];
    const requests = [req('GET', ['api', 'properties'])];
    const report = compareRoutes(routes, requests);
    expect(report.missing.map((r) => `${r.method} ${r.path}`)).toEqual(['DELETE /api/property-requests/:id']);
  });

  it('reports extra collection requests (path not on server)', () => {
    const routes = [server('GET', '/api/properties')];
    const requests = [req('GET', ['api', 'properties']), req('POST', ['api', 'does-not-exist'])];
    const report = compareRoutes(routes, requests);
    expect(report.extra.map((r) => r.method)).toEqual(['POST']);
    expect(report.extra[0].path).toEqual('api/does-not-exist');
  });

  it('reports mismatched methods for an existing path', () => {
    const routes = [server('PATCH', '/api/payments/:id/refund')];
    const requests = [req('POST', ['api', 'payments', '{{paymentId}}', 'refund'])];
    const report = compareRoutes(routes, requests);
    expect(report.mismatched.map((r) => r.method)).toEqual(['POST']);
    expect(report.extra).toHaveLength(0);
  });

  it('flags duplicates keyed by method + path + body-mode', () => {
    const routes = [server('POST', '/api/properties')];
    const requests = [
      req('POST', ['api', 'properties'], 'raw', 'A'),
      req('POST', ['api', 'properties'], 'raw', 'B'),
    ];
    const report = compareRoutes(routes, requests);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0].map((r) => r.name)).toEqual(['A', 'B']);
  });

  it('does not flag different body modes as duplicates', () => {
    const routes = [server('POST', '/api/properties')];
    const requests = [
      req('POST', ['api', 'properties'], 'raw', 'A'),
      req('POST', ['api', 'properties'], 'formdata', 'B'),
    ];
    const report = compareRoutes(routes, requests);
    expect(report.duplicates).toHaveLength(0);
  });

  it('keeps the server verfiyOtp spelling exact (no normalization rewrite)', () => {
    const routes = [server('POST', '/api/auth/verfiyOtp')];
    const requests = [req('POST', ['api', 'auth', 'verfiyOtp'])];
    const report = compareRoutes(routes, requests);
    expect(report.missing).toHaveLength(0);
    expect(report.extra).toHaveLength(0);
  });
});
