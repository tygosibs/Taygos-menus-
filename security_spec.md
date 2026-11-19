# Security Specification: Multi-Tenant QR Menu SaaS (Phase 1 & 2)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document in `restaurants`, `categories`, `menu_items`, and `orders` carries `ownerId` and `restaurantId`. Only the verified owner (`request.auth.uid == ownerId`) may mutate restaurant config, categories, menu items, or read/update orders.
2. **PII Isolation**: Customer orders (`orders` collection) are never publicly readable (`get` and `list` strictly enforce `resource.data.ownerId == request.auth.uid`). Public visitors can only `create` an order with `status == 'pending'` when the parent restaurant exists.
3. **Immutable Ownership & Timestamps**: `ownerId`, `restaurantId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Terminal State Locking**: Once an order reaches `completed` or `cancelled`, no further updates are allowed.
5. **Slug Integrity**: `/slugs/{slug}` maps each unique slug to its `restaurantId` and `ownerId`. Only the owner can create, update, or delete their own slug mapping.
6. **Table Session Scoping**: `/restaurants/{restaurantId}/table_sessions/{sessionId}` validates parent restaurant existence, matches `ownerId`, bounds `guests <= 30` and `items <= 80`, enforces ASCII-safe `sessionId`, and locks `list` queries to the restaurant owner or Super Admin.
7. **Service Call Isolation**: `/service_calls/{callId}` allows public creation only with `status == 'pending'` against an existing restaurant (`ownerId` matched), while `get`, `list`, `update`, and `delete` are strictly isolated to the restaurant owner or Super Admin with terminal locking at `resolved`.
8. **Halls & Station Routing Integrity**: `/halls/{hallId}` enforces bounded `tableCount` (`1..200`) and strict owner/Super Admin write isolation (`ownerId == request.auth.uid`). Category and MenuItem `station` values are constrained to `['kitchen', 'bar', 'pastry']`.

## 2. The "Dirty Dozen" Attack Payloads
1. **DD-01**: Creating a restaurant with `ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
2. **DD-02**: Injecting a shadow key `isAdmin: true` into `restaurants` -> `PERMISSION_DENIED`.
3. **DD-03**: Overwriting another owner's `/slugs/{slug}` -> `PERMISSION_DENIED`.
4. **DD-04**: Creating a category linked to another owner's `restaurantId` or invalid `station` -> `PERMISSION_DENIED`.
5. **DD-05**: Modifying `basePrice` on a `menu_items` doc owned by another restaurant -> `PERMISSION_DENIED`.
6. **DD-06**: Unauthenticated `list` query on `/orders` or `/service_calls` -> `PERMISSION_DENIED`.
7. **DD-07**: Authenticated non-owner `get` on `/orders/{orderId}` or `/service_calls/{callId}` -> `PERMISSION_DENIED`.
8. **DD-08**: Visitor creating an order or service call bypassing `status: 'pending'` -> `PERMISSION_DENIED`.
9. **DD-09**: Owner updating an order or service call that is already `completed`/`cancelled`/`resolved` -> `PERMISSION_DENIED`.
10. **DD-10**: Submitting oversized document ID (`> 128` chars) or invalid characters -> `PERMISSION_DENIED`.
11. **DD-11**: Forging `createdAt` or `updatedAt` != `request.time` -> `PERMISSION_DENIED`.
12. **DD-12**: Creating an order, table session, or service call referencing a non-existent `restaurantId` or mismatched `ownerId` -> `PERMISSION_DENIED`.
13. **DD-13**: Injecting shadow fields (`isFree: true`) or exceeding `items` / `guests` bounds on `table_sessions` -> `PERMISSION_DENIED`.
14. **DD-14**: Creating a `service_calls` document with an arbitrary/invalid `callType` -> `PERMISSION_DENIED`.
15. **DD-15**: Creating or updating a `halls` document under another restaurant's `restaurantId` or `tableCount > 200` -> `PERMISSION_DENIED`.
