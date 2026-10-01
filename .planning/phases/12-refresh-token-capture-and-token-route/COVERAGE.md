# API Coverage — Microsoft identity platform (Entra ID) OAuth 2.0 v2.0 endpoints

> Full coverage by default. Opt-outs are explicit, reasoned decisions.

Phase 12 calls Entra in three places. Two already existed: the authorize request and the code exchange, which now also ask for `offline_access`. The third is new: a refresh-token grant made through `@avora/tracker-client`'s `redeemTrackerToken`. That package owns the HTTP call and the error classification, so this matrix covers the capabilities ACMI's confidential web client touches through it. The detector found no API-integration signal in the phase scope (`detected: false`). The phase still talks to an external identity API, so this matrix records what it uses and what it does not.

| capability | decision | reason |
|---|---|---|
| authorize request (`/oauth2/v2.0/authorize`, code flow) with `offline_access` | INTEGRATE | |
| authorization-code grant (`/oauth2/v2.0/token`) with `offline_access` | INTEGRATE | |
| refresh-token grant for the tracker scope (via `redeemTrackerToken`) | INTEGRATE | |
| refresh-token rotation (new `refresh_token` in the grant response) | INTEGRATE | |
| token-endpoint error responses (`error`, `error_codes` via `tokenErrorResponse`) | INTEGRATE | |
| `id_token` returned by the refresh grant | OPT-OUT | not needed: the route uses only the access token, and sign-in identity still comes from the code exchange |
| client-credentials grant | OPT-OUT | not needed: tracker requests are delegated, per signed-in user |
| on-behalf-of grant | OPT-OUT | not needed: the browser calls the tracker directly with the redeemed token, so there is no middle tier |
| device-code flow | OPT-OUT | not needed: ACMI is a web app with server-side sign-in |
| interactive consent prompt (`prompt=consent`) | OPT-OUT | explicitly out of scope: consent is an admin decision made in the Entra portal (D-11) |
| Entra sign-out or session revocation (`/oauth2/v2.0/logout`) | OPT-OUT | not needed yet: logout clears ACMI's own cookies (RT-04), as the other host apps in the spec do |
| server-side access-token cache | OPT-OUT | not needed: the browser holds the short-lived access token, and the route redeems on demand |
