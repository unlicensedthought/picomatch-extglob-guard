# picomatch-extglob-guard

picomatch 4.0.7 with one change: repeated extglobs, `+(...)` and `*(...)`, throw a `TypeError`
(code `E_PICOMATCH_GUARD_REPEATED_EXTGLOB`) instead of being compiled to a regex. Plus a small
script that copies the package into a repo and fails the build if the copy ever differs from it.

This is a derivative of [picomatch](https://github.com/micromatch/picomatch) (MIT, Jon Schlinkert).
Not affiliated with it.

## The problem

picomatch is a glob matcher that sits under vite, vitest, tinyglobby, fdir and many other build tools.
An advisory against picomatch through 4.0.7 (GHSA-fc5q-39xc-vjpf) says some repeated-extglob patterns
compile to regexes that backtrack badly. As of 2026-11-18 the latest npm release is still 4.0.7, and OSV
lists the advisory as withdrawn with no fixed version. This repo does not publish any pattern or timing for it.

If your tools never pass `+(...)` or `*(...)` to picomatch, refusing them costs nothing and removes
the whole class of input. `?(...)`, `@(...)`, `!(...)`, escaped `\+\(` and `noextglob: true` are unchanged.

## Quick start

```bash
git clone https://github.com/unlicensedthought/picomatch-extglob-guard
cd picomatch-extglob-guard

# copy it into your repo, with a .source stamp
node scripts/vendor.mjs sync /path/to/your/repo

# in your package.json
#   "devDependencies": { "picomatch": "file:./vendor/picomatch-extglob-guard" },
#   "overrides":       { "picomatch": "$picomatch" }
npm install && npm ls picomatch

# in your CI / verify step
node /path/to/picomatch-extglob-guard/scripts/vendor.mjs check /path/to/your/repo
```

The `$picomatch` form matters: a plain `file:` override can make npm loop on packages that list
picomatch as a peer. For pnpm use `pnpm.overrides` and check with `pnpm why picomatch`.

## How it works

- `lib/` is picomatch 4.0.7, byte for byte, except one block in `lib/parse.js` (`extglobOpen`).
  `diff` it against `npm pack picomatch@4.0.7` to see it: seven added lines, two of them comments.
- `sync` writes `vendor/picomatch-extglob-guard/` and a `.source` stamp: version, file count, and a
  tree hash (sha256 over sorted `<path>\t<git blob id>` lines, `.source` excluded). It refuses to
  overwrite a directory that has no stamp.
- `check` exits 1 when the vendored tree differs from its stamp (one changed byte, an extra file, a
  missing file), or when the stamp does not match this package's own tree (a forged or stale stamp), or
  when nothing is vendored. It also runs `scripts/upstream-check.mjs`, which asks OSV and the npm
  registry whether a fixed picomatch exists. Exit 10 there means "drop the guard".
  If that lookup cannot run, `check` warns and passes; `--strict-upstream` makes it fail.
  `--offline` skips it. Exit 2 is usage or environment.

## What it does not do

- It does not fix picomatch. It refuses a construct. Anything that needs `+(...)` or `*(...)` breaks.
- It does not cover picomatch 2.x. Only 4.0.7.
- `check` proves the copy matches this package. It does not prove the package is safe, or that no
  other copy of picomatch is in your tree. `npm ls picomatch` does that part.
- The drift check is a hash compare, not a signature. Whoever can edit both the copy and its
  `.source` stamp can make `check` pass against that copy's own tree, but not against this package's.
- The upstream lookup depends on the OSV record. A withdrawn record with no `fixed` event reads
  as "still unfixed".

## Tests

```bash
scripts/verify.sh          # install, build, test, sync/check smoke; last line is VERIFY {...}
npm test                   # node --test, no dependencies
```

- 104 golden cases (patterns x paths x options), recorded from real picomatch 4.0.7: matches, compiled
  regex source and `scan` output must be identical.
- Every repeated extglob is refused on `picomatch()`, `isMatch`, `makeRe` and `parse`, in under 50 ms.
- A negative run: the same refusal check, run on a copy of this tree with the guard block cut out,
  must fail. Set `PICOMATCH_UPSTREAM_DIR` to an unpacked upstream picomatch to see it fail there too.
- Drift: sync then check passes; a changed byte, an extra file, a missing file and a forged stamp
  each fail; sync will not overwrite an unstamped directory.

Re-record the golden: `node test/record-golden.cjs <path to unpacked picomatch 4.0.7>`.

## License

Apache-2.0 for the new parts (`scripts/`, `test/`, the guard block), see `LICENSE`.
picomatch's files stay MIT with the original copyright, see `LICENSE-picomatch` and `NOTICE`.
