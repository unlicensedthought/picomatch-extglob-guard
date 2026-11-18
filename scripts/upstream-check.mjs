#!/usr/bin/env node
// Is the upstream fix out? Run this whenever a tool that depends on picomatch is upgraded.
//   exit 0   still unfixed: keep the override
//   exit 10  a fixed picomatch is published: drop the override and use upstream
//   exit 2   could not tell (network or registry error): it says why
import { readFileSync } from 'node:fs';

const { upstream } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const fail = (event, fields) => {
  console.error(JSON.stringify({ level: 'error', tool: 'picomatch-extglob-guard', event, ...fields }));
  process.exit(2);
};
const getJson = async (url, init) => {
  let r;
  try {
    r = await fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    fail('fetch.failed', { url, err: String(e) });
  }
  if (!r.ok) fail('fetch.status', { url, status: r.status });
  return r.json();
};

const vuln = await getJson(`https://api.osv.dev/v1/vulns/${upstream.advisory}`);
const fixed = vuln.affected.flatMap((a) => a.ranges ?? []).flatMap((r) => r.events).filter((e) => e.fixed).map((e) => e.fixed);
const reg = await getJson(`https://registry.npmjs.org/${upstream.package}`);
const newer = Object.keys(reg.versions).filter((v) => !v.includes('-') && v.localeCompare(upstream.version, undefined, { numeric: true }) > 0);
const report = { tool: 'picomatch-extglob-guard', advisory: upstream.advisory, withdrawn: vuln.withdrawn ?? null, vendored: upstream.version, fixed_in: fixed, newer_releases: newer, latest: reg['dist-tags']?.latest };
if (fixed.length > 0) {
  console.log(JSON.stringify({ ...report, verdict: 'FIXED upstream: drop the picomatch override and the vendored copy' }));
  process.exit(10);
}
console.log(JSON.stringify({ ...report, verdict: newer.length ? 'newer releases exist but the advisory lists no fix: check them, keep the override' : 'still unfixed: keep the override' }));
