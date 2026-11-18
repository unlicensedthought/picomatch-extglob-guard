// The negative run: the refusal check below must pass on the guard and FAIL on an unguarded copy of
// the same tree (the guard block cut out of lib/parse.js, which leaves upstream's parser) or, when
// PICOMATCH_UPSTREAM_DIR points at a real upstream picomatch, on that. A check that cannot fail is no check.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const CODE = 'E_PICOMATCH_GUARD_REPEATED_EXTGLOB';
const CASES = [['+(a)', 'aaa'], ['+(a|b)', 'abab'], ['*(a)', 'aaa']];

function assertRefusesFast(pm) {
  for (const [pattern, input] of CASES) {
    const t = process.hrtime.bigint();
    let err;
    try { pm.isMatch(input, pattern); } catch (e) { err = e; }
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    assert.ok(err && err.code === CODE, `${pattern} was not refused (it ran ${ms.toFixed(0)} ms)`);
    assert.ok(ms < 50, `${pattern} was refused after ${ms.toFixed(0)} ms, not under 50 ms`);
  }
}

function unguardedCopy() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pm-unguarded-'));
  for (const f of ['index.js', 'posix.js', 'lib/constants.js', 'lib/parse.js', 'lib/picomatch.js', 'lib/scan.js', 'lib/utils.js']) {
    if (!fs.existsSync(path.join(root, f))) continue;
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.copyFileSync(path.join(root, f), path.join(dir, f));
  }
  const parse = path.join(dir, 'lib/parse.js');
  const src = fs.readFileSync(parse, 'utf8');
  const block = /    if \(type === 'plus' \|\| type === 'star'\) \{\n[\s\S]*?\n    \}\n/;
  assert.ok(block.test(src), 'the guard block is where the negative test expects it');
  fs.writeFileSync(parse, src.replace(block, ''));
  return dir;
}

test('the refusal check passes on the guard', () => {
  assertRefusesFast(require(root));
});

test('the refusal check fails on an unguarded copy of the same tree', () => {
  const dir = unguardedCopy();
  try {
    assert.throws(() => assertRefusesFast(require(dir)), /was not refused|not under 50 ms/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the refusal check fails on real upstream picomatch', { skip: !process.env.PICOMATCH_UPSTREAM_DIR }, () => {
  assert.throws(() => assertRefusesFast(require(path.resolve(process.env.PICOMATCH_UPSTREAM_DIR))), /was not refused|not under 50 ms/);
});
