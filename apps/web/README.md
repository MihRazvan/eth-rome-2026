# EXIT web

React/Vite client. Integrator owns dependencies and live adapter. `App` receives `AppData` and `AppActions` from `src/model.ts`; UI does not authorize transactions or perform financial arithmetic.

Run Vite from apps/web: `../../node_modules/.bin/vite --host 127.0.0.1 --port 5174`.

`/?preview=1` enables design fixtures. `&role=seller` enables owner review/Portfolio fixtures. `&concept=calendar` and `&concept=desk` are isolated comparisons. Preview transactions reject. The default route never substitutes fixtures when access fails.

`node docs/design/check-browser.cjs` checks explicit preview at port 5174. Evidence and independent critique are under docs/design. This does not prove chain settlement or live integrations.
