export type LanguageCode = 'en' | 'ta' | 'hi' | 'te' | 'ml' | 'kn';

export type ServiceCategory =
  | 'temple'
  | 'hospital'
  | 'bank'
  | 'mall'
  | 'post_office'
  | 'government'
  | 'retail'
  | 'cinema'
  | 'restaurant'
  | 'college'
  | 'other';

export type CrowdLevel = 'low' | 'moderate' | 'high' | 'very_high';

export type GeneralBusyness = 'quiet' | 'moderate' | 'busy';

export type PriorityTier = 'standard' | 'senior' | 'disability' | 'medical';

export type TokenStatus = 'waiting' | 'in_progress' | 'serving' | 'completed' | 'skipped' | 'cancelled';

export type DataSource = 'live_provider' | 'google_places';

export type NotificationType =
  | 'booking'
  | 'token_generated'
  | 'wait_update'
  | 'five_ahead'
  | 'two_ahead'
  | 'approaching'
  | 'your_turn'
  | 'delay'
  | 'cancelled'
  | 'skipped';

export type AppScreen =
  | 'splash'
  | 'language'
  | 'auth'
  | 'home'
  | 'explore'
  | 'place_details'
  | 'booking'
  | 'digital_token'
  | 'live_queue'
  | 'notifications'
  | 'history'
  | 'profile'
  | 'staff_dashboard'
  | 'reports';

export interface NotificationPrefs {
  fiveAhead: boolean;
  turnReady: boolean;
  delays: boolean;
  browserPush: boolean;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  phoneNumber?: string;
  email?: string;
  language: LanguageCode;
  role: 'user' | 'staff';
  favoriteLocationIds: string[];
  notificationPrefs: NotificationPrefs;
  fcmToken?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface UserNotification {
  id: string;
  userId: string;
  locationId: string;
  tokenId?: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  createdAtMs: number;
}

export interface ServiceLocation {
  id: string;
  ownerId: string;
  googlePlaceId?: string;
  name: string;
  organizationGroup: string;
  category: ServiceCategory;
  address: string;
  lat: number;
  lng: number;
  operatingHours: string;
  isOpenNow?: boolean | null;
  businessStatus?: string;
  rating?: number | null;
  hasLiveCrowdData: boolean;
  crowdLevel: CrowdLevel | null;
  crowdPercentage: number | null;
  generalBusyness?: GeneralBusyness | null;
  maxCapacity?: number;
  waitingCount: number | null;
  avgServiceMinutes: number;
  delayMinutes: number;
  currentlyServingNumber: number | null;
  lastTokenSequence: number;
  currentlyServingCode: string | null;
  isPaused: boolean;
  isActive: boolean;
  dataSource: DataSource;
  services: string[];
  counters: string[];
  imageKey?: string;
  photoUrl?: string;
  bestTimeNote?: string;
  updatedAtMs: number | null;
}

export interface QueueToken {
  id: string;
  locationId: string;
  locationOwnerId: string;
  locationName: string;
  userId: string;
  holderLabel: string;
  tokenCode: string;
  sequenceNumber: number;
  serviceName: string;
  slotLabel: string;
  priorityTier: PriorityTier;
  priorityWeight: number;
  status: TokenStatus;
  counterName?: string;
  skipReason?: string;
  estimatedWaitMinutes: number;
  createdAtMs: number;
  updatedAtMs: number;
}

export interface LatLngLiteral {
  lat: number;
  lng: number;
}

export interface RouteEstimate {
  distanceMeters: number;
  durationMinutes: number;
  encodedPolyline?: string;
  source: 'google_routes' | 'haversine_estimate';
}

export interface DiscoveredGooglePlace {
  googlePlaceId: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: ServiceCategory;
  operatingHours?: string;
  isOpenNow?: boolean | null;
  businessStatus?: string;
  rating?: number | null;
  photoUrl?: string;
}

export interface RecentlyViewedLocation {
  id: string;
  googlePlaceId?: string;
  name: string;
  address: string;
  category: ServiceCategory;
  lat: number;
  lng: number;
  photoUrl?: string;
  isOpenNow?: boolean | null;
  viewedAtMs: number;
}

// Blueprint-synchronized validation constants
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  ID_MAX: 128,
  DISPLAY_NAME_MAX: 80,
  PHONE_MAX: 20,
  LOCATION_NAME_MAX: 120,
  ORG_GROUP_MAX: 80,
  ADDRESS_MAX: 240,
  HOURS_MAX: 100,
  SERVICE_NAME_MAX: 80,
  COUNTER_NAME_MAX: 40,
  SKIP_REASON_MAX: 160,
  NOTIF_TITLE_MAX: 120,
  NOTIF_MESSAGE_MAX: 400,
  FCM_TOKEN_MAX: 512,
  MAX_FAVORITES: 30,
  MAX_SERVICES: 15,
  MAX_COUNTERS: 15,
} as const;

export function sanitizeString(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

export function makeSafeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, BLUEPRINT_LIMITS.ID_MAX);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

export interface ParsedTokenQr {
  tokenId?: string;
  locationId?: string;
  tokenCode?: string;
}

export function buildTokenQrPayload(token: Pick<QueueToken, 'id' | 'locationId' | 'tokenCode'>): string {
  return JSON.stringify({
    app: 'QLite',
    locationId: token.locationId,
    tokenId: token.id,
    tokenCode: token.tokenCode,
  });
}

export function parseTokenQrPayload(rawText: string): ParsedTokenQr | null {
  const trimmed = rawText.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (parsed && (typeof parsed.tokenId === 'string' || typeof parsed.tokenCode === 'string')) {
      return {
        tokenId: typeof parsed.tokenId === 'string' ? parsed.tokenId : undefined,
        locationId: typeof parsed.locationId === 'string' ? parsed.locationId : undefined,
        tokenCode: typeof parsed.tokenCode === 'string' ? parsed.tokenCode : undefined,
      };
    }
  } catch {
    // Not JSON — try URL or raw ID/code
  }

  if (trimmed.startsWith('qlite://')) {
    try {
      const url = new URL(trimmed);
      const tok = url.searchParams.get('tok') || undefined;
      const loc = url.searchParams.get('loc') || undefined;
      const code = url.searchParams.get('code') || undefined;
      if (tok || code) return { tokenId: tok, locationId: loc, tokenCode: code };
    } catch {
      // Ignore malformed URI
    }
  }

  if (/^[TMP]-\d{2,}$/i.test(trimmed)) {
    return { tokenCode: trimmed.toUpperCase() };
  }

  if (BLUEPRINT_LIMITS.ID_PATTERN.test(trimmed)) {
    return { tokenId: trimmed };
  }

  return null;
}
