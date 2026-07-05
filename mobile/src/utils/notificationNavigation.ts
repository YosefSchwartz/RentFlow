import type { Notification } from '../types';

// Where a notification's "Move to" action should take the user. `tab` is a
// bottom-tab route and `screen`/`params` target a screen inside that tab's
// stack. Returns null when the notification has no navigable destination
// (e.g. document notifications, which have no dedicated detail screen).
export interface NotificationTarget {
  tab: 'Properties' | 'Rentals';
  screen: string;
  params: Record<string, unknown>;
}

export const getNotificationTarget = (
  notification: Notification,
): NotificationTarget | null => {
  const { entityId, type } = notification;
  if (!entityId) return null;

  switch (type) {
    // Landlord is the recipient — open the request in the landlord stack.
    case 'MAINTENANCE_CREATED':
      return {
        tab: 'Properties',
        screen: 'MaintenanceDetail',
        params: { requestId: entityId },
      };
    // Tenant is the recipient — open the request in the tenant stack.
    case 'MAINTENANCE_UPDATED':
    case 'MAINTENANCE_RESOLVED':
      return {
        tab: 'Rentals',
        screen: 'MaintenanceDetail',
        params: { requestId: entityId },
      };
    // Tenant is the recipient — open the lease in the tenant stack.
    case 'LEASE_APPROVED':
    case 'LEASE_REJECTED':
      return {
        tab: 'Rentals',
        screen: 'LeaseDetails',
        params: { leaseId: entityId },
      };
    // Landlord requested a document — tenant opens their documents for the
    // property (entityId is the propertyId).
    case 'DOCUMENT_REQUESTED':
      return {
        tab: 'Rentals',
        screen: 'TenantDocuments',
        params: { propertyId: entityId },
      };
    // A requested document was uploaded — landlord opens the property documents
    // (entityId is the propertyId).
    case 'DOCUMENT_UPLOADED':
      return {
        tab: 'Properties',
        screen: 'PropertyDocuments',
        params: { propertyId: entityId },
      };
    default:
      return null;
  }
};
