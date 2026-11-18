export interface DirtyDozenCase {
  id: string;
  description: string;
  path: string;
  operation: 'create' | 'update' | 'get' | 'list' | 'delete';
  expected: 'PERMISSION_DENIED';
}

export const DIRTY_DOZEN_CASES: DirtyDozenCase[] = [
  { id: 'DD-01', description: 'Restaurant create with mismatched ownerId', path: '/restaurants/rest_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-02', description: 'Shadow key isAdmin injected into restaurant', path: '/restaurants/rest_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-03', description: 'Slug hijacking by non-owner', path: '/slugs/taken-slug', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-04', description: 'Category poisoned under another owner restaurantId', path: '/categories/cat_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-05', description: 'MenuItem price tampered by non-owner', path: '/menu_items/item_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-06', description: 'Unauthenticated list query on orders', path: '/orders', operation: 'list', expected: 'PERMISSION_DENIED' },
  { id: 'DD-07', description: 'Cross-tenant get on orders', path: '/orders/ord_1', operation: 'get', expected: 'PERMISSION_DENIED' },
  { id: 'DD-08', description: 'Public order create bypassing pending status', path: '/orders/ord_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-09', description: 'Updating terminal completed order', path: '/orders/ord_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-10', description: 'Invalid oversized document ID', path: '/restaurants/bad..id', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-11', description: 'Client-forged createdAt timestamp', path: '/orders/ord_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-12', description: 'Orphaned order with invalid restaurantId/ownerId', path: '/orders/ord_1', operation: 'create', expected: 'PERMISSION_DENIED' },
];
