process.env.NODE_ENV = 'test';

const fs = require('fs');
const path = require('path');
const { collectRoutes } = require('./lib/collectRoutes');
const { compareRoutes } = require('./lib/normalize');

const ROOT = path.resolve(__dirname, '..', '..');
const COLLECTION_PATH = path.join(ROOT, 'docs', 'postman', 'Sakan-Server.postman_collection.json');

function collectRequests(items, requests) {
  for (const item of items) {
    if (item.request) {
      const url = typeof item.request.url === 'object' ? item.request.url : null;
      requests.push({
        method: item.request.method || '',
        pathSegments: url && Array.isArray(url.path) ? url.path : [],
        request: item.request,
        name: item.name || '',
      });
    }
    if (Array.isArray(item.item)) collectRequests(item.item, requests);
  }
  return requests;
}

function printBucket(title, entries) {
  console.log(`${title}: ${entries.length}`);
  for (const entry of entries) {
    if (Array.isArray(entry)) {
      console.log(`  ${entry[0].method} /${String(entry[0].path).replace(/^\//, '')}`);
    } else if (entry && entry.method && entry.path !== undefined) {
      console.log(`  ${entry.method} /${String(entry.path).replace(/^\//, '')}`);
    }
  }
}

function main() {
  let serverRoutes;
  try {
    serverRoutes = collectRoutes();
  } catch (err) {
    console.error(`Failed to enumerate server routes: ${err.message}`);
    process.exit(2);
  }

  let collection;
  try {
    collection = JSON.parse(fs.readFileSync(COLLECTION_PATH, 'utf8'));
  } catch (err) {
    console.error(`Failed to read collection: ${err.message}`);
    process.exit(2);
  }

  const requests = collectRequests(collection.item || [], []);
  const report = compareRoutes(serverRoutes, requests);

  printBucket('Missing (server route not in collection)', report.missing);
  printBucket('Extra (collection request not a server route)', report.extra);
  printBucket('Mismatched (path present, different method)', report.mismatched);
  printBucket('Duplicates (repeated method + path + body-mode)', report.duplicates);

  const total = report.missing.length + report.extra.length + report.mismatched.length + report.duplicates.length;
  console.log(
    `\n${serverRoutes.length} server routes vs ${requests.length} collection requests (${new Set(
      requests.map((r) => `${r.method} ${r.pathSegments.join('/')}`)
    ).size} distinct)`
  );

  if (total > 0) {
    console.log(`COVERAGE CHECK FAILED (${total} issue(s))`);
    process.exit(1);
  }
  console.log('COVERAGE CHECK PASSED');
  process.exit(0);
}

main();
