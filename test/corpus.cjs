// Patterns and paths the guard must treat exactly as upstream picomatch 4.0.7 does. The patterns
// include vite's and vitest's own defaults (single ?(...) extglobs) and common config globs.
exports.patterns = [
  '**/*.{test,spec}.?(c|m)[jt]s?(x)', '**/*.{test,spec}-d.?(c|m)[jt]s?(x)', '**/node_modules/**', '**/dist/**',
  '**/*.ts', 'src/**/*.{js,ts}', '**/!(*.d).ts', '@(a|b)/*.js', '!(foo).md', 'foo/**', '*.md', '**/.*',
  '[abc].txt', 'a/{b,c}/d', '**/__tests__/**', 'api/test/**/*.test.ts', '**/*.d.ts', '!**/node_modules/**',
  'src/*.?(m)js', '**/{coverage,.git}/**', 'a/**/b/*.json', '?.js', '**', '*', 'a\\*b', 'a/b/c.js',
];
exports.paths = [
  'src/a.test.ts', 'src/a.spec.mjs', 'src/a.test.cjs', 'src/b.test-d.ts', 'b.spec.tsx', 'node_modules/x/index.js',
  'a/node_modules/b.js', 'dist/x.js', 'x/dist/y/z.js', 'main.ts', 'x.d.ts', 'lib/x.d.ts', 'src/q/r.js', 'src/q/r.ts',
  'a/x.js', 'b/y.js', 'c/z.js', 'foo.md', 'bar.md', 'foo/bar/baz', '.env', 'x/.hidden', 'a.txt', 'd.txt',
  'a/b/d', 'a/c/d', 'a/e/d', 'pkg/__tests__/t.js', 'api/test/health.test.ts', 'src/x.mjs', 'src/x.js', 'src/x.cjs',
  'coverage/lcov.info', '.git/HEAD', 'a/x/y/b/c.json', 'a/b/c.json', 'q.js', 'qq.js', 'a*b', 'axb', 'a/b/c.js', '',
];
exports.options = [{}, { dot: true }, { nocase: true }, { windows: false, posix: true }];
