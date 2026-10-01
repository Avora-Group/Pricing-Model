# Phase 12: Refresh-token capture and token route - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-01
**Phase:** 12-refresh-token-capture-and-token-route
**Areas discussed:** Session gate strength, Lifetime and rotation, Bad key and failure isolation, Verification and commits

---

## Session gate strength

**How should POST /api/tracker/token check the session before redeeming?**

| Option | Description | Selected |
|--------|-------------|----------|
| Decode, check exp, bind sub | JWE carries `{ rt, sub }`; the route decodes `access_token`, checks `exp` and that `sub` matches; no network call | ✓ |
| Decode and check exp only | `reauth` if `access_token` is missing, unparseable or expired; JWE is `{ rt }` | |
| Presence only | `reauth` only when there is no `access_token` cookie | |
| Verify via FastAPI | Call `/auth/me` on every token fetch | |

**Should the route also check Origin?**

| Option | Description | Selected |
|--------|-------------|----------|
| No Origin check | Match the sibling apps; Lax plus no CORS already cover forged cross-site requests | ✓ |
| Reject foreign Origin | 401 when `Origin` is present and foreign | |
| You decide | Leave it to the planner | |

---

## Lifetime and rotation

**How long should a re-set `tracker_rt` live after rotation?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sliding 7 days + JWE exp | Same attributes on every set; JWE `exp` now + 7d | ✓ |
| Pinned to sign-in | Remaining time carried in the JWE | |
| Sliding 7 days, no JWE exp | Cookie `maxAge` only | |

**Delete the cookie on a reauth that `tracker_rt` itself caused?**

| Option | Description | Selected |
|--------|-------------|----------|
| Delete on bad cookie | Won't decrypt, past `exp` or `sub` mismatch → expire it; Entra `invalid_grant` → leave it | ✓ |
| Delete on every reauth | Including Entra's | |
| Never delete in the route | Cleared only by logout or the next sign-in | |

**How does a signed-in user without `tracker_rt` get one?**

| Option | Description | Selected |
|--------|-------------|----------|
| Sign out and in; note it for Phase 13 | Phase 12 changes nothing; Phase 13 could link to `/api/auth/login/azure?next=…` | ✓ |
| Re-sign-in route in Phase 12 | Confirm and document the login route for signed-in users | |
| Accept as-is | One-time cost | |

**What happens to an old `tracker_rt` when a sign-in can't set a new one?**

| Option | Description | Selected |
|--------|-------------|----------|
| Clear it | Every sign-in either sets it fresh or deletes it | ✓ |
| Leave it | Only add, never remove | |

---

## Bad key and failure isolation

**What if `TRACKER_RT_KEY` is set but malformed?**

| Option | Description | Selected |
|--------|-------------|----------|
| Treat as unconfigured | Callback skips the cookie and logs; route returns 503 `unconfigured` | ✓ |
| Route says config | 503 `config` instead | |
| Fail loudly at build | A prebuild or startup check | |

**What about the `offline_access` consent risk?**

| Option | Description | Selected |
|--------|-------------|----------|
| Check portal before UAT; stop on prompt | The user confirms Graph `offline_access` admin consent first; execution stops on any prompt | ✓ |
| Local sign-in is the test | No up-front check | |
| Defer to Phase 14 | Deploy prerequisite only | |

---

## Verification and commits

**What verification beyond build, lint and UAT?**

| Option | Description | Selected |
|--------|-------------|----------|
| Helper unit tests + static checks | Self-contained `tracker-rt.ts` tested with `node:test`, plus grep-style checks | ✓ |
| Static checks only | No TS import | |
| Build, lint and UAT only | The spec's baseline | |

**Who puts the local env values in place?**

| Option | Description | Selected |
|--------|-------------|----------|
| You, from a printed command | Agents never touch `.env*` | ✓ |
| Agent appends to .env.local | Faster, but breaks the rule | |

**How many commits?**

| Option | Description | Selected |
|--------|-------------|----------|
| One per plan | Each commit can be reverted alone | ✓ |
| One commit for the phase | As in Phase 11 | |
| You decide | Planner's call | |

---

## Claude's Discretion

- The helper's file and function names, the log-line wording, how the plans split the work, and how `Set-Cookie` is attached to the package's `Response` objects.
- Checking `aud` and `azp` in UAT by decoding only the claims, never showing the token (recorded as D-16 without a separate question).

## Deferred Ideas

- Phase 13: the `reauth` notice could link to `/api/auth/login/azure?next=<current path>`, so users without `tracker_rt` can recover without signing out.
