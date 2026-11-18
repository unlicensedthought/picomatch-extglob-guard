const test = require('node:test');
const assert = require('node:assert');
const pm = require('..');
const golden = require('./golden.json');
const { paths } = require('./corpus.cjs');

test('every corpus pattern matches, compiles and scans exactly as upstream picomatch 4.0.7', () => {
  assert.strictEqual(golden.upstream, '4.0.7');
  assert.ok(golden.cases.length > 100);
  for (const c of golden.cases) {
    const m = pm(c.p, c.o);
    assert.deepStrictEqual(paths.filter((x) => m(x)), c.hits, `hits for ${c.p} ${JSON.stringify(c.o)}`);
    assert.strictEqual(pm.makeRe(c.p, c.o).source, c.re, `regex for ${c.p}`);
    assert.deepStrictEqual(pm.scan(c.p), c.scan, `scan for ${c.p}`);
  }
});

test('repeated extglobs are refused on every entry point, fast, with a stable error code', () => {
  const bad = ['+(a)', '+(a|b)', '*(a)', '**/+(x).js', 'src/*(foo|bar)', ['ok/*.js', '+(a)']];
  const calls = [(p) => pm(p), (p) => pm.isMatch('aaaa!', p), (p) => pm.makeRe(Array.isArray(p) ? p[1] : p), (p) => pm.parse(Array.isArray(p) ? p[1] : p)];
  for (const p of bad) for (const call of calls) {
    const t = process.hrtime.bigint();
    assert.throws(() => call(p), (e) => e instanceof TypeError && e.code === 'E_PICOMATCH_GUARD_REPEATED_EXTGLOB', `refuses ${JSON.stringify(p)}`);
    assert.ok(process.hrtime.bigint() - t < 50_000_000n, `refuses ${JSON.stringify(p)} in under 50 ms`);
  }
});

test('escaped or disabled extglobs are not refused', () => {
  assert.strictEqual(pm.isMatch('+(a)', '\\+\\(a\\)'), true);
  assert.doesNotThrow(() => pm('+(a)', { noextglob: true }));
});

test('?(...), @(...) and !(...) still work', () => {
  assert.strictEqual(pm.isMatch('a.mjs', '*.?(m)js'), true);
  assert.strictEqual(pm.isMatch('b/x.js', '@(a|b)/*.js'), true);
  assert.strictEqual(pm.isMatch('x.d.ts', '!(*.d).ts'), false);
});
