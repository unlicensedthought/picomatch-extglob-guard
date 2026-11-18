// Run once against UPSTREAM picomatch to write golden.json: node test/record-golden.cjs <path-to-upstream>
const { patterns, paths, options } = require('./corpus.cjs');
const pm = require(require('node:path').resolve(process.argv[2]));
const out = { upstream: require(require('node:path').resolve(process.argv[2], 'package.json')).version, cases: [] };
for (const o of options) for (const p of patterns) {
  const m = pm(p, o);
  out.cases.push({ p, o, re: pm.makeRe(p, o).source, scan: pm.scan(p), hits: paths.filter((x) => m(x)) });
}
require('node:fs').writeFileSync(require('node:path').join(__dirname, 'golden.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`recorded ${out.cases.length} cases from picomatch ${out.upstream}`);
