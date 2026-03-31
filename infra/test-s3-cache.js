'use strict';

// Unit tests for LRU cache logic (no AWS credentials needed)

const { LRUCache } = require('./s3-cache');

let pass = 0;
let fail = 0;

function assert(condition, msg) {
  if (condition) {
    pass++;
    console.log(`  [PASS] ${msg}`);
  } else {
    fail++;
    console.log(`  [FAIL] ${msg}`);
  }
}

console.log('--- LRUCache tests ---\n');

// Basic get/set
const c = new LRUCache(3);
c.set('a', 1, 5000);
c.set('b', 2, 5000);
c.set('c', 3, 5000);
assert(c.get('a') === 1, 'get returns cached value');
assert(c.get('z') === undefined, 'get returns undefined for missing key');
assert(c.size === 3, 'size tracks entries');

// Eviction (max 3, adding 4th evicts oldest)
c.set('d', 4, 5000);
assert(c.size === 3, 'size stays at max after eviction');
// 'b' should be evicted (a was accessed via get, making it recently used)
assert(c.get('b') === undefined, 'oldest entry evicted');
assert(c.get('a') === 1, 'recently accessed entry survives eviction');
assert(c.get('d') === 4, 'new entry accessible');

// TTL expiry
const c2 = new LRUCache(10);
c2.set('x', 'val', 1); // 1ms TTL
setTimeout(() => {
  assert(c2.get('x') === undefined, 'expired entry returns undefined');

  // Invalidate
  const c3 = new LRUCache(10);
  c3.set('k', 'v', 60000);
  assert(c3.get('k') === 'v', 'entry exists before invalidate');
  c3.invalidate('k');
  assert(c3.get('k') === undefined, 'entry gone after invalidate');

  // Clear
  c3.set('a', 1, 60000);
  c3.set('b', 2, 60000);
  c3.clear();
  assert(c3.size === 0, 'clear empties cache');

  console.log(`\n--- Results: ${pass} passed, ${fail} failed ---`);
  process.exit(fail > 0 ? 1 : 0);
}, 50);
