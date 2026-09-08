# API cache classification

Both legacy `/api/...` and versioned `/api/v1/...` routes use the same classification. Redis is cache-aside and optional: a Redis timeout/error must fall back to MySQL rather than fail the API.

## CACHEABLE — implemented

| Route | Initial TTL | Notes |
|---|---:|---|
| `GET /products` | 60s | Anonymous only; normalized filters/search/page/sort in key. |
| `GET /products/search` | 60s | Anonymous only; separate search namespace. |
| `GET /products/:id` | 180s | Anonymous approved/public detail only. |
| `GET /products/expiring` | 60s | Public approved product projection. |
| `GET /meta/platforms` | 900s | Public metadata. |
| `GET /meta/languages` | 900s | Public metadata. |
| `GET /badges/all` | 300s | Public badge catalog. |
| `GET /membership/tiers` | 600s | Public plan catalog. |
| `GET /membership/addons` | 600s | Public add-on catalog. |

## SHORT CACHE — candidates, intentionally not enabled until measured

| Route | Reason to consider | Invalidation requirement |
|---|---|---|
| `GET /badges/leaderboard` | Read-heavy/public-like | Badge award/user stat mutations. |
| `GET /auth/reviews/dashboard/summary` | Aggregate summary | Review create/edit/delete. |
| `GET /products/live`, `/promoted`, `/premium` | Public catalog subsets | Same product mutation invalidation as product lists. |

These remain uncached until live measurements show they are material bottlenecks.

## NO CACHE — authentication/security

`POST /auth/register`, `/login`, `/login/verify-2fa`, `/login/resend-2fa`, `/refresh`, `/logout`, `/logout-everywhere`, `/verify-email`, `/verify-email/code`, `/password/request`, `/password/reset`, `/password/change`, `/verify-user`, `/verify-buyer`, `/profile/privacy`, `/profile/photos`, `/profile/update`, `/username/update`, `/account/delete`, review mutations; `GET /auth/me`; detailed verification workflow state.

Reason: tokens, identity, private/user-specific state, anti-abuse state, or security-sensitive mutation.

## NO CACHE — private/user-specific reads

- `GET /auth/profile/:userId`, `/auth/verification-status/:userId`, `/auth/reviews/:userId`
- `GET /products/mine`, `/products/pending`, product ownership/claim review endpoints
- `GET /badges/user/:userId`, `/badges/stats/:userId`, `/badges/profile/:userId`, `/badges/my-*`
- `GET /membership/my-membership`, `/membership/membership/:userId`, `/membership/fee`, `/membership/addon/my-addons`, `/membership/addon/:userId`, `/membership/addon/color/:userId`
- all notification reads
- all chat/direct-chat/support-chat reads

Reason: authorization/user-specific data and invalidation complexity outweigh an unmeasured cache benefit.

## NO CACHE — financial/state-changing marketplace operations

- all transaction endpoints, including buy/confirm/stage/escrow assignment
- all bid endpoints (reads and mutations)
- all escrow endpoints (reads, timers, release, dispute, admin operations)
- membership subscribe/cancel/add-on purchase
- badge award/check endpoints

Stale financial/availability state is unacceptable. Product list/detail caches are invalidated **after** transaction/bid/escrow mutations that reserve, sell, refund, hide, publish, edit, create, approve, or delete a listing.

## NO CACHE — administration

All `/admin/*` routes, including user management, statistics, IP bans, product/comment/review/chat inspection, ad-space mutations and ID-verification review/image access.

Reason: private privileged data and operational correctness take priority over caching.

## Key structure

- `getsocs:products:list:{sha256(normalized-query)}`
- `getsocs:products:search:{sha256(normalized-query)}`
- `getsocs:products:detail:{id}`
- `getsocs:metadata:platforms`
- `getsocs:metadata:languages`
- `getsocs:badges:all`
- `getsocs:membership:tiers`
- `getsocs:membership:addons`

Query keys are sorted/normalized before hashing; sensitive values are not written directly into Redis keys. Product mutation invalidation clears the affected detail key plus list/search variants. Redis `SCAN`, not blocking `KEYS`, is used for namespace invalidation.

## TTL tuning rule

The values above are starting points only. Compare Phase 0 and final benchmarks plus hit ratio/evictions. Do not increase TTL merely to improve the hit ratio if stale marketplace data becomes user-visible.
