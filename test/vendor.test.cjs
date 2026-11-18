const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const tool = path.resolve(__dirname, '..', 'scripts', 'vendor.mjs');
const run = (verb, repo, ...flags) => spawnSync(process.execPath, [tool, verb, repo, ...flags], { encoding: 'utf8' });
const vendored = (repo) => path.join(repo, 'vendor', 'picomatch-extglob-guard');

function freshRepo() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pm-consumer-'));
}

test('sync then check passes', () => {
  const repo = freshRepo();
  try {
    assert.strictEqual(run('sync', repo).status, 0);
    const r = run('check', repo, '--offline');
    assert.strictEqual(r.status, 0, r.stderr);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('one changed byte, one extra file and one missing file each fail check', () => {
  for (const mutate of [
    (d) => fs.appendFileSync(path.join(d, 'lib', 'utils.js'), ' '),
    (d) => fs.writeFileSync(path.join(d, 'lib', 'extra.js'), ''),
    (d) => fs.rmSync(path.join(d, 'posix.js')),
  ]) {
    const repo = freshRepo();
    try {
      assert.strictEqual(run('sync', repo).status, 0);
      mutate(vendored(repo));
      const r = run('check', repo, '--offline');
      assert.strictEqual(r.status, 1, r.stderr);
      assert.match(r.stderr, /edited after sync/);
    } finally { fs.rmSync(repo, { recursive: true, force: true }); }
  }
});

test('a forged stamp fails check', () => {
  const repo = freshRepo();
  try {
    assert.strictEqual(run('sync', repo).status, 0);
    const d = vendored(repo);
    fs.appendFileSync(path.join(d, 'lib', 'utils.js'), ' ');
    const stampFile = path.join(d, '.source');
    const stamp = JSON.parse(fs.readFileSync(stampFile, 'utf8'));
    fs.writeFileSync(stampFile, JSON.stringify({ ...stamp, tree: '0'.repeat(64) }));
    const r = run('check', repo, '--offline');
    assert.strictEqual(r.status, 1, r.stderr);
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('sync refuses to overwrite a directory that has no stamp', () => {
  const repo = freshRepo();
  try {
    fs.mkdirSync(vendored(repo), { recursive: true });
    fs.writeFileSync(path.join(vendored(repo), 'hand-copy.js'), 'x');
    assert.strictEqual(run('sync', repo).status, 2);
    assert.ok(fs.existsSync(path.join(vendored(repo), 'hand-copy.js')));
  } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});

test('check fails when nothing is vendored', () => {
  const repo = freshRepo();
  try { assert.strictEqual(run('check', repo, '--offline').status, 1); } finally { fs.rmSync(repo, { recursive: true, force: true }); }
});
