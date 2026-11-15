# Dependency security maintenance

Use Node.js 24. CI audits dependencies and builds the application.

npm is now the canonical package manager so version-scoped overrides preserve older dependency APIs while patching the affected toolchain. The npm lockfile replaces yarn.lock. Run `npm ci`, `npm audit`, and `npm run build`. Vite 6 keeps the existing multi-page build. The SDK uuid override and scoped glob/minimatch/brace-expansion overrides address affected transitive dependencies. Existing lint still reports one explicit-any error in unchanged src/helpers/isPlainObject.ts.
