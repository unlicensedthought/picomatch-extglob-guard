#!/usr/bin/env node
// Copy this package into a consumer repo and prove the copy has not drifted.
//   node scripts/vendor.mjs sync  <repo>
//   node scripts/vendor.mjs check <repo> [--offline] [--strict-upstream]
// Exit codes: 0 ok, 1 drift or upstream fix, 2 usage or environment error.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEST = 'vendor/picomatch-extglob-guard';
const STAMP = '.source';
const TOOL = 'picomatch-extglob-guard';
const SHIPPED = ['index.js', 'posix.js', 'lib', 'package.json', 'LICENSE-picomatch', 'scripts/upstream-check.mjs'];

const log = (level, event, fields = {}) => console.error(JSON.stringify({ level, tool: TOOL, event, ...fields }));
const die = (event, fields) => { log('error', event, fields); process.exit(2); };

const blobId = (buf) => createHash('sha1').update(`blob ${buf.length}\0`).update(buf).digest('hex');
const treeHash = (entries) => {
  const h = createHash('sha256');
  for (const [p, id] of [...entries].sort((a, b) => (a[0] < b[0] ? -1 : 1))) h.update(`${p}\t${id}\n`);
  return h.digest('hex');
};

function walk(dir, base = dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p, base));
    else out.push(relative(base, p).split(sep).join('/'));
  }
  return out;
}

function listTree(root, only) {
  const rels = only ? only.flatMap((e) => (statSync(join(root, e)).isDirectory() ? walk(join(root, e), root) : [e])) : walk(root);
  return rels.filter((r) => r !== STAMP).map((r) => [r, blobId(readFileSync(join(root, r)))]);
}

function diff(want, got) {
  const w = new Map(want), g = new Map(got), d = [];
  for (const [p, id] of w) d.push(...(!g.has(p) ? [`missing:${p}`] : g.get(p) !== id ? [`changed:${p}`] : []));
  for (const p of g.keys()) if (!w.has(p)) d.push(`extra:${p}`);
  return d.sort();
}

function readStamp(dir) {
  let s;
  try { s = JSON.parse(readFileSync(join(dir, STAMP), 'utf8')); } catch (e) { throw new Error(`no readable ${STAMP}: ${e.message}`); }
  if (s.tool !== TOOL || !s.tree) throw new Error(`${STAMP} is not a ${TOOL} stamp`);
  return s;
}

function sync(repo) {
  const dest = join(repo, DEST);
  if (existsSync(dest) && readdirSync(dest).length > 0) {
    try { readStamp(dest); } catch (e) { die('sync.refused', { dest, detail: `refusing to overwrite an unstamped directory (${e.message})` }); }
  }
  mkdirSync(join(repo, 'vendor'), { recursive: true });
  const tmp = mkdtempSync(join(repo, 'vendor', '.sync-'));
  try {
    const entries = listTree(ROOT, SHIPPED);
    for (const [rel] of entries) {
      mkdirSync(dirname(join(tmp, rel)), { recursive: true });
      writeFileSync(join(tmp, rel), readFileSync(join(ROOT, rel)));
    }
    const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version;
    const stamp = { tool: TOOL, version, tree: treeHash(entries), files: entries.length };
    writeFileSync(join(tmp, STAMP), JSON.stringify(stamp, null, 2) + '\n');
    rmSync(dest, { recursive: true, force: true });
    renameSync(tmp, dest);
    chmodSync(dest, 0o755);
    log('info', 'sync.ok', { dest: DEST, ...stamp });
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

function check(repo, { offline, strict }) {
  const dest = join(repo, DEST);
  if (!existsSync(dest)) return [`${DEST} is not vendored: run sync`];
  let stamp;
  try { stamp = readStamp(dest); } catch (e) { return [`${DEST}: ${e.message}: re-run sync`]; }
  const problems = [];
  const got = listTree(dest);
  if (treeHash(got) !== stamp.tree) {
    problems.push(`${DEST} was edited after sync (${diff(listTree(ROOT, SHIPPED), got).join(', ')})`);
  }
  const canonical = listTree(ROOT, SHIPPED);
  if (treeHash(canonical) !== stamp.tree) {
    problems.push(`${DEST}: stamp ${stamp.tree.slice(0, 12)} does not match this package's tree ${treeHash(canonical).slice(0, 12)}: re-run sync`);
  }
  if (!offline) {
    const r = spawnSync(process.execPath, [join(dest, 'scripts/upstream-check.mjs')], { encoding: 'utf8' });
    if (r.status === 10) problems.push(`upstream has a fix: drop the guard and the override. ${r.stdout.trim()}`);
    else if (r.status !== 0) {
      const msg = `could not tell whether upstream is fixed (exit ${r.status}): ${(r.stderr || '').trim()}`;
      if (strict) problems.push(msg); else log('warn', 'upstream.unknown', { detail: msg });
    }
  }
  return problems;
}

const [verb, repo, ...flags] = process.argv.slice(2);
if (!['sync', 'check'].includes(verb) || !repo || !existsSync(repo)) {
  die('usage', { detail: 'node scripts/vendor.mjs sync|check <repo> [--offline] [--strict-upstream]' });
}
if (verb === 'sync') sync(repo);
else {
  const problems = check(repo, { offline: flags.includes('--offline'), strict: flags.includes('--strict-upstream') });
  for (const p of problems) log('error', 'check.fail', { problem: p });
  if (problems.length) process.exit(1);
  log('info', 'check.ok', { repo });
}
