# Security Specification: Multi-Tenant QR Menu SaaS (Phase 1 & 2)

## 1. Data Invariants
1. **Strict Tenant Isolation**: Every document in `restaurants`, `categories`, `menu_items`, and `orders` carries `ownerId` and `restaurantId`. Only the verified owner (`request.auth.uid == ownerId`) may mutate restaurant config, categories, menu items, or read/update orders.
2. **PII Isolation**: Customer orders (`orders` collection) are never publicly readable (`get` and `list` strictly enforce `resource.data.ownerId == request.auth.uid`). Public visitors can only `create` an order with `status == 'pending'` when the parent restaurant exists.
3. **Immutable Ownership & Timestamps**: `ownerId`, `restaurantId`, and `createdAt` cannot be modified after creation. `createdAt` and `updatedAt` must equal `request.time`.
4. **Terminal State Locking**: Once an order reaches `completed` or `cancelled`, no further updates are allowed.
5. **Slug Integrity**: `/slugs/{slug}` maps each unique slug to its `restaurantId` and `ownerId`. Only the owner can create, update, or delete their own slug mapping.

## 2. The "Dirty Dozen" Attack Payloads
1. **DD-01**: Creating a restaurant with `ownerId != request.auth.uid` -> `PERMISSION_DENIED`.
2. **DD-02**: Injecting a shadow key `isAdmin: true` into `restaurants` -> `PERMISSION_DENIED`.
3. **DD-03**: Overwriting another owner's `/slugs/{slug}` -> `PERMISSION_DENIED`.
4. **DD-04**: Creating a category linked to another owner's `restaurantId` -> `PERMISSION_DENIED`.
5. **DD-05**: Modifying `basePrice` on a `menu_items` doc owned by another restaurant -> `PERMISSION_DENIED`.
6. **DD-06**: Unauthenticated `list` query on `/orders` -> `PERMISSION_DENIED`.
7. **DD-07**: Authenticated non-owner `get` on `/orders/{orderId}` -> `PERMISSION_DENIED`.
8. **DD-08**: Visitor creating an order with `status: 'completed'` -> `PERMISSION_DENIED`.
9. **DD-09**: Owner updating an order that is already `completed` or `cancelled` -> `PERMISSION_DENIED`.
10. **DD-10**: Submitting oversized document ID (`> 128` chars) or invalid characters -> `PERMISSION_DENIED`.
11. **DD-11**: Forging `createdAt` or `updatedAt` != `request.time` -> `PERMISSION_DENIED`.
12. **DD-12**: Creating an order referencing a non-existent `restaurantId` or mismatched `ownerId` -> `PERMISSION_DENIED`.
