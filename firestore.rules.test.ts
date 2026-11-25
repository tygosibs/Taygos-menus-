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
  { id: 'DD-13', description: 'Shadow key injected into table_sessions', path: '/restaurants/rest_1/table_sessions/tbl_5_abcd', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-14', description: 'Invalid callType or cross-tenant list on service_calls', path: '/service_calls/call_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-15', description: 'Cross-tenant hall write or tableCount > 200', path: '/halls/hall_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-16', description: 'Customer loyalty list scraping or resetting firstOrderDiscountUsed', path: '/restaurants/rest_1/customers/01012345678', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-17', description: 'Poisoned loyaltyConfig percent > 50 or shadow key', path: '/restaurants/rest_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-18', description: 'Non-SuperAdmin writing/listing platform_promo_codes or redeeming invalid code', path: '/platform_promo_codes/BDAY50', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-19', description: 'Malformed ownerBirthday or shadow key in platform_settings/landing', path: '/platform_settings/landing', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-20', description: 'Staff without canCancelOpenOrders or empty cancelReason trying to cancel open order', path: '/orders/ord_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-21', description: 'Staff without canApplyInstantDiscount or missing manualDiscountReason trying instant discount', path: '/orders/ord_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-22', description: 'Staff without canSettleChecks trying to mark order completed/paid', path: '/orders/ord_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-23', description: 'Updating closed order after its linked shift completed without Super Admin unlock', path: '/orders/ord_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-24', description: 'Manager with canManageStaff attempting to grant higher permissions/screens above their ceiling', path: '/restaurants/rest_1/job_titles/jt_1', operation: 'create', expected: 'PERMISSION_DENIED' },
  { id: 'DD-25', description: 'Pause-only staff (canPauseItems without canEditMenu) trying to modify basePrice on menu item', path: '/menu_items/item_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-26', description: 'Staff with canConfigureOperations attempting to escalate operationsConfig.managerPermissions', path: '/restaurants/rest_1', operation: 'update', expected: 'PERMISSION_DENIED' },
  { id: 'DD-27', description: 'Prep station or non-CRM staff attempting to list customer loyalty records', path: '/restaurants/rest_1/customers', operation: 'list', expected: 'PERMISSION_DENIED' },
];

