const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const ROUTES_DIR = path.join(ROOT, 'Routes');

const USE_LINE_RE = /router\.use\(\s*["']([^"']+)["']\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g;
const REQUIRE_LINE_RE = /(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*require\(["'](\.\/[^"']+)["']\)/g;

function getMounts(filePath) {
  const resolved = filePath.endsWith('.js') ? filePath : `${filePath}.js`;
  let source;
  try {
    source = fs.readFileSync(resolved, 'utf8');
  } catch {
    return [];
  }

  const requiredByVar = new Map();
  let m;
  REQUIRE_LINE_RE.lastIndex = 0;
  while ((m = REQUIRE_LINE_RE.exec(source)) !== null) {
    requiredByVar.set(m[1], path.join(ROUTES_DIR, m[2]));
  }

  const mounts = [];
  USE_LINE_RE.lastIndex = 0;
  while ((m = USE_LINE_RE.exec(source)) !== null) {
    const moduleFile = requiredByVar.get(m[2]);
    if (moduleFile) mounts.push({ prefix: m[1], varName: m[2], moduleFile });
  }
  return mounts;
}

function buildMountsByHandle(filePath) {
  const byHandle = new Map();
  for (const mount of getMounts(filePath)) {
    const child = require(mount.moduleFile);
    byHandle.set(child, mount);
  }
  return byHandle;
}

function collectFromStack(stack, prefix, mountsByHandle, emitted) {
  for (const layer of stack) {
    if (layer.route) {
      const fullPath = prefix + layer.route.path;
      const methods = Object.keys(layer.route.methods).filter((method) => method !== '_all');
      for (const method of methods) {
        emitted.push({ method: method.toUpperCase(), path: fullPath });
      }
    } else if (layer.name === 'router' && layer.handle && Array.isArray(layer.handle.stack)) {
      const mount = mountsByHandle.get(layer.handle);
      const nextPrefix = mount ? prefix + mount.prefix : prefix;
      const childMounts = mount ? buildMountsByHandle(mount.moduleFile) : mountsByHandle;
      collectFromStack(layer.handle.stack, nextPrefix, childMounts, emitted);
    }
  }
  return emitted;
}

function collectRoutes() {
  const mainRoute = require(path.join(ROUTES_DIR, 'index'));
  return collectFromStack(mainRoute.stack, '/api', buildMountsByHandle(path.join(ROUTES_DIR, 'index.js')), []);
}

module.exports = { collectRoutes, collectFromStack, getMounts };
