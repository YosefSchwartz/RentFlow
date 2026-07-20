// User model - no longer role-based, users can be both landlord and tenant
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  emailVerified: boolean;
  avatarUrl?: string | null;
  createdAt: string;
  updatedAt: string;
}

// Dashboard response from GET /me/dashboard
export interface DashboardResponse {
  user: User;
  ownedPropertiesCount: number;
  activeLeasesCount: number;
  canAccessLandlord: boolean;
  canAccessTenant: boolean;
}

// Property model
export interface Property {
  id: string;
  title: string;
  address: string;
  city: string;
  squareMeters: number;
  rooms: number;
  floor?: number;
  hasBalcony: boolean;
  hasParking: boolean;
  hasStorage: boolean;
  hasShelter: boolean;
  notes?: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  // Structured location fields (from Google Places)
  formattedAddress?: string;
  street?: string;
  streetNumber?: string;
  latitude?: number;
  longitude?: number;
  placeId?: string;
}

// Location data from Google Places
export interface LocationData {
  formattedAddress: string;
  city: string;
  street?: string;
  streetNumber?: string;
  latitude: number;
  longitude: number;
  placeId: string;
}

// Lease model - represents active relationship between tenant and property
export type LeaseStatus = 'ACTIVE' | 'PENDING' | 'EXPIRED' | 'TERMINATED';

export interface Lease {
  id: string;
  propertyId: string;
  // Null until a tenant redeems the lease's activation code ("Unassigned").
  tenantId: string | null;
  status: LeaseStatus;
  startDate: string;
  endDate: string;
  monthlyRent?: number;
  depositAmount?: number;
  notes?: string;
  // Present only on owner-facing responses for an unassigned lease.
  activationCode?: string | null;
  activationCodeExpiresAt?: string | null;
  property?: Property & { owner?: { id: string; firstName: string; lastName: string; email: string } };
  tenant?: User | null;
  createdAt: string;
  updatedAt: string;
}

// A landlord-owned lease — no tenant at creation.
export interface CreateLeaseRequest {
  propertyId: string;
  startDate: string;
  endDate?: string;
  monthlyRent?: number;
  depositAmount?: number;
  notes?: string;
}

// Document visibility and required-document workflow status
export type DocumentVisibility = 'PRIVATE' | 'SHARED';
export type DocumentStatus = 'OPTIONAL' | 'REQUESTED' | 'RECEIVED';

// Document model - documents can belong to a Property OR a Lease
export interface Document {
  id: string;
  propertyId?: string;
  leaseId?: string;
  name: string;
  category: DocumentCategory;
  // A REQUESTED document has no file until the tenant uploads it.
  fileUrl?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
  visibility: DocumentVisibility;
  status: DocumentStatus;
  requestedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  // Present on the landlord's required-documents listing.
  lease?: {
    id: string;
    tenant?: { id: string; firstName: string; lastName: string; email: string };
  };
}

// Property document categories
export type PropertyDocumentCategory =
  | 'INSURANCE'
  | 'WARRANTY'
  | 'METER_READING'
  | 'PROPERTY_PHOTO'
  | 'INVOICE'
  | 'MANUAL';

// Lease document categories
export type LeaseDocumentCategory =
  | 'LEASE_AGREEMENT'
  | 'SIGNED_LEASE'
  | 'GUARANTOR_DOCUMENT'
  | 'ADDENDUM';

// Standardized categories (aligned with the document workflow)
export type StandardDocumentCategory =
  | 'IDENTIFICATION'
  | 'LEGAL'
  | 'PROPERTY_INFO'
  | 'TENANT_DOCUMENT';

// All document categories
export type DocumentCategory =
  | PropertyDocumentCategory
  | LeaseDocumentCategory
  | StandardDocumentCategory
  | 'CONTRACT'  // Backward compatibility
  | 'OTHER';

// Legacy alias for backward compatibility
export type DocumentType = DocumentCategory;

// Category options for UI pickers
export const PROPERTY_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'INSURANCE',
  'WARRANTY',
  'METER_READING',
  'PROPERTY_PHOTO',
  'INVOICE',
  'MANUAL',
  'OTHER',
];

export const LEASE_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'LEASE_AGREEMENT',
  'SIGNED_LEASE',
  'GUARANTOR_DOCUMENT',
  'ADDENDUM',
  'OTHER',
];

// Standardized category set surfaced in pickers (legacy values still render
// for existing documents via their translation keys).
export const STANDARD_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'LEASE_AGREEMENT',
  'IDENTIFICATION',
  'INVOICE',
  'LEGAL',
  'PROPERTY_INFO',
  'TENANT_DOCUMENT',
  'OTHER',
];

// Categories a landlord typically requests from a tenant.
export const REQUESTABLE_DOCUMENT_CATEGORIES: DocumentCategory[] = [
  'IDENTIFICATION',
  'LEASE_AGREEMENT',
  'LEGAL',
  'TENANT_DOCUMENT',
  'OTHER',
];

// Maintenance request model
export interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: number;
  propertyId: string;
  requesterId: string;
  requester?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  property?: {
    id: string;
    title: string;
    address?: string;
  };
  resolvedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MaintenanceComment {
  id: string;
  body: string;
  requestId: string;
  authorId: string;
  author?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  createdAt: string;
}

export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

// Media types (shared shape; two separate domains: property gallery vs. maintenance)
export type MediaType = 'IMAGE' | 'VIDEO';

// Property gallery media — photos/videos of the property itself
export interface PropertyMedia {
  id: string;
  propertyId: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: MediaType;
  uploadedById?: string | null;
  createdAt: string;
}

// Evidence files attached to a maintenance request
export interface MaintenanceAttachment {
  id: string;
  maintenanceRequestId: string;
  url: string;
  fileName: string;
  mimeType: string;
  size: number;
  type: MediaType;
  uploadedById?: string | null;
  createdAt: string;
}

// A locally-picked media file pending upload (from camera or library)
export interface LocalMediaFile {
  uri: string;
  name: string;
  type: string; // mime type
  mediaType: MediaType;
}

// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
}

export interface AuthResponse {
  user: User;
  token: string;
}

// API response wrapper
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
}

// Create/Update DTOs
export interface CreatePropertyRequest {
  title: string;
  // Location from Google Places (preferred)
  location?: LocationData;
  // Legacy fields (kept for backward compatibility)
  address?: string;
  city?: string;
  squareMeters: number;
  rooms: number;
  floor?: number;
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasStorage?: boolean;
  hasShelter?: boolean;
  notes?: string;
}

export interface UpdatePropertyRequest extends Partial<CreatePropertyRequest> {}

export interface CreateMaintenanceRequest {
  title: string;
  description: string;
  priority: number;
  propertyId: string;
  leaseId?: string;
}

// A tenant redeems a lease activation code.
export interface RedeemLeaseRequest {
  code: string;
}

// Navigation types
export type RootStackParamList = {
  Auth: undefined;
  ExperienceSelection: undefined;
  Main: undefined;
  // Also reachable from the experience-selection screen (same screens are
  // registered in the Profile stack for the in-app tabs).
  Notifications: undefined;
  Settings: undefined;
};

export type AuthStackParamList = {
  Login: { prefillEmail?: string } | undefined;
  Register: undefined;
  VerifyEmail: { email: string };
  ForgotPassword: undefined;
  ResetPassword: { email: string };
};

// Main app with bottom tabs
export type MainTabParamList = {
  Properties: undefined;
  Rentals: undefined;
  Profile: undefined;
};

// Properties (Landlord) stack
export type PropertiesStackParamList = {
  PropertiesList: undefined;
  PropertyDetails: { propertyId: string };
  // Per-section screens reached from the PropertyDetails quick actions.
  PropertyLeases: { propertyId: string };
  PropertyPhotos: { propertyId: string };
  PropertyDocuments: { propertyId: string };
  PropertyMaintenance: { propertyId: string };
  CreateProperty: undefined;
  EditProperty: { propertyId: string };
  // Shows a lease's activation code for the landlord to share.
  LeaseActivationCode: { leaseId: string; code: string };
  CreateLease: { propertyId: string };
  MaintenanceDetail: { requestId: string };
  PropertyMap: PropertyMapParams;
};

// Rentals (Tenant) stack
export type RentalsStackParamList = {
  RentalsList: undefined;
  JoinProperty: undefined;
  TenantHome: { leaseId: string };
  LeaseDetails: { leaseId: string };
  TenantDocuments: { propertyId: string; leaseId?: string };
  TenantGallery: { propertyId: string };
  TenantMaintenance: { propertyId: string; leaseId?: string };
  CreateMaintenanceRequest: { propertyId: string; leaseId?: string };
  MaintenanceDetail: { requestId: string };
  PropertyMap: PropertyMapParams;
};

// Params for the shared full-screen map, reached from both the landlord
// (PropertiesStack) and tenant (RentalsStack) navigators.
export interface PropertyMapParams {
  latitude: number;
  longitude: number;
  address: string;
}

// Property owner info (for tenant contact)
export interface PropertyOwner {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

// Property owner info kept for tenant-facing contact display.
export interface TenantPropertyDetails {
  id: string;
  title: string;
  address: string;
  city: string;
  squareMeters?: number;
  rooms?: number;
  floor?: number;
  hasBalcony?: boolean;
  hasParking?: boolean;
  hasStorage?: boolean;
  hasShelter?: boolean;
  notes?: string;
  owner: PropertyOwner;
}

// Profile stack
export type ProfileStackParamList = {
  ProfileMain: undefined;
  EditProfile: undefined;
  Settings: undefined;
  Notifications: undefined;
};

// Notification types
export type NotificationType =
  | 'LEASE_PENDING'
  | 'LEASE_APPROVED'
  | 'LEASE_REJECTED'
  | 'MAINTENANCE_CREATED'
  | 'MAINTENANCE_UPDATED'
  | 'MAINTENANCE_RESOLVED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_REQUESTED';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkAllReadResponse {
  markedAsRead: number;
}
