# Component scope compatibility

`scripts/css-component-scopes.mjs` expands the finite component scopes introduced
by this reduction: one parent selector, no parent declarations, direct leaf child
rules whose selector branches each start with their only `&`. Comments, rule and
declaration order, fallback values, `!important`, URLs and selector-list spacing
are retained. Parent selector lists and pseudo-elements, including legacy and
escaped spellings, cannot be compiled through this path.

The default pure function and PostCSS plugin pass other existing native nesting
through to the existing CSS pipeline. `strict: true` rejects unsupported shapes
when auditing a newly generated scope in isolation. This batch provides old
browser compatibility for its newly introduced scope syntax; it does not add a
compatibility claim for previously existing native nesting.

Validation: 26 helper tests and the 7 existing standalone-minifier tests pass
together (33 total); targeted ESLint and the source syntax check pass.
The default helper also parsed all 149 current `game/css` files without errors and
produced idempotent output. The parent owns Vite and standalone-asset integration;
helper tests cover PostCSS source maps and the pure expansion's independence from
minification/debug options. No build or browser acceptance was run by this slice.

The initial mixed-sibling test exposed loss of the scope's leading line break;
the first expanded child now inherits that outer spacing, and the test passes.
Integration review also exposed automatic reading of invalid inline maps during
the pure string probe. That probe now parses with `map: false`; both invalid
inline and missing external annotations on flat CSS remain byte-identical.
