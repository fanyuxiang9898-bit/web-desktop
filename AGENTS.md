# Web Desktop

- Keep original webpage nodes and parents intact. Do not replace page HTML or clone interactive widgets.
- Use GridStack's engine for geometry; verify non-overlap and node retention for every transaction.
- Persist only layout metadata, never form values, HTML, cookies, tokens, or page bodies.
- Keep website permissions optional and scoped to explicitly enabled hosts.
- Any persistence change requires a full browser close/reopen regression, not only a page refresh.
- Build with `npm run build`; test with `npm test`, `npm run test:browser`, `npm run test:extension` while the loopback demo server is running.
- Do not commit `work`, `node_modules`, `test-results`, browser profiles or local account details.
