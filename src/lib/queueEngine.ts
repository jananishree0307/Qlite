/// <reference types="google.maps" />
import {
  CrowdLevel,
  DiscoveredGooglePlace,
  GeneralBusyness,
  LatLngLiteral,
  PriorityTier,
  QueueToken,
  ServiceCategory,
  ServiceLocation,
  makeSafeId,
} from '../types/qlite';

export function getPriorityWeight(tier: PriorityTier): number {
  switch (tier) {
    case 'medical':
      return 3;
    case 'disability':
      return 2;
    case 'senior':
      return 1;
    default:
      return 0;
  }
}

export function formatTokenCode(sequence: number, tier: PriorityTier): string {
  const prefix = tier === 'standard' ? 'T' : tier === 'medical' ? 'M' : 'P';
  return `${prefix}-${String(sequence).padStart(3, '0')}`;
}

export function computeCrowdPercentage(waitingCount: number, maxCapacity = 35): number {
  const cap = Math.max(1, maxCapacity);
  return Math.min(100, Math.max(0, Math.round((waitingCount / cap) * 100)));
}

export function normalizeCrowdLevel(raw?: string | null): CrowdLevel | null {
  if (!raw) return null;
  if (raw === 'low' || raw === 'moderate' || raw === 'high' || raw === 'very_high') {
    return raw;
  }
  if (raw === 'heavy') {
    return 'very_high';
  }
  return null;
}

export function computeCrowdLevel(waitingCount: number, crowdPercentage?: number | null): CrowdLevel {
  if (typeof crowdPercentage === 'number') {
    if (crowdPercentage <= 30) return 'low';
    if (crowdPercentage <= 60) return 'moderate';
    if (crowdPercentage <= 85) return 'high';
    return 'very_high';
  }
  if (waitingCount <= 6) return 'low';
  if (waitingCount <= 15) return 'moderate';
  if (waitingCount <= 26) return 'high';
  return 'very_high';
}

export function mapGooglePlaceTypesToCategory(
  primaryType?: string | null,
  types?: string[]
): ServiceCategory {
  const candidates = [primaryType, ...(types || [])].filter(Boolean) as string[];
  for (const type of candidates) {
    if (
      type === 'hindu_temple' ||
      type === 'place_of_worship' ||
      type === 'church' ||
      type === 'mosque' ||
      type === 'buddhist_temple' ||
      type === 'synagogue'
    ) {
      return 'temple';
    }
    if (
      type === 'hospital' ||
      type === 'doctor' ||
      type === 'clinic' ||
      type === 'medical_lab' ||
      type === 'pharmacy' ||
      type === 'dentist'
    ) {
      return 'hospital';
    }
    if (type === 'bank' || type === 'atm') {
      return 'bank';
    }
    if (type === 'shopping_mall' || type === 'department_store') {
      return 'mall';
    }
    if (type === 'movie_theater') {
      return 'cinema';
    }
    if (type === 'post_office') {
      return 'post_office';
    }
    if (
      type === 'local_government_office' ||
      type === 'city_hall' ||
      type === 'courthouse' ||
      type === 'embassy'
    ) {
      return 'government';
    }
    if (
      type === 'supermarket' ||
      type === 'grocery_store' ||
      type === 'store' ||
      type === 'electronics_store' ||
      type === 'clothing_store' ||
      type === 'convenience_store'
    ) {
      return 'retail';
    }
    if (
      type === 'restaurant' ||
      type === 'cafe' ||
      type === 'food_court' ||
      type === 'bakery'
    ) {
      return 'restaurant';
    }
    if (type === 'university' || type === 'school') {
      return 'college';
    }
  }
  return 'other';
}

/**
 * Computes Open / Closed status accurately from Google Places OpeningHours periods & UTC offset
 * without requiring beta-only Place.isOpen().
 */
export function computeIsOpenNow(
  businessStatus?: string | null,
  openingHours?: google.maps.places.OpeningHours | null,
  utcOffsetMinutes?: number | null
): boolean | null {
  if (businessStatus === 'CLOSED_PERMANENTLY' || businessStatus === 'CLOSED_TEMPORARILY') {
    return false;
  }
  const periods = openingHours?.periods;
  if (!periods || periods.length === 0) {
    return null;
  }

  // Open 24 hours convention: single period opening at Sunday 00:00 with no close
  if (periods.length === 1 && periods[0].open && !periods[0].close) {
    return true;
  }

  const offsetMs =
    typeof utcOffsetMinutes === 'number'
      ? utcOffsetMinutes * 60_000
      : -new Date().getTimezoneOffset() * 60_000;

  const venueLocal = new Date(Date.now() + offsetMs);
  const currentDay = venueLocal.getUTCDay(); // 0 (Sun) - 6 (Sat)
  const currentMinute = currentDay * 1440 + venueLocal.getUTCHours() * 60 + venueLocal.getUTCMinutes();
  const WEEK_MINUTES = 7 * 1440;

  for (const period of periods) {
    const open = period.open;
    const close = period.close;
    if (!open) continue;
    if (!close) return true;

    const openMin = open.day * 1440 + open.hour * 60 + open.minute;
    let closeMin = close.day * 1440 + close.hour * 60 + close.minute;
    if (closeMin <= openMin) {
      closeMin += WEEK_MINUTES;
    }

    // Check both current week and wrapped week view
    if (
      (currentMinute >= openMin && currentMinute < closeMin) ||
      (currentMinute + WEEK_MINUTES >= openMin && currentMinute + WEEK_MINUTES < closeMin)
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Non-percentage general venue pace hint for unconnected Google Places.
 * Explicitly distinct from verified live queue data — never fabricates percentages or people waiting.
 */
export function computeGeneralBusyness(category: ServiceCategory): GeneralBusyness {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  const isWeekend = day === 0 || day === 6;

  switch (category) {
    case 'temple': {
      const darshan = (hour >= 6 && hour <= 11) || (hour >= 17 && hour <= 20);
      return darshan ? (isWeekend ? 'busy' : 'moderate') : 'quiet';
    }
    case 'hospital': {
      const opd = (hour >= 9 && hour <= 13) || (hour >= 16 && hour <= 19);
      return opd ? 'busy' : hour >= 22 || hour <= 6 ? 'quiet' : 'moderate';
    }
    case 'bank':
    case 'post_office':
    case 'government': {
      if (isWeekend) return 'quiet';
      return hour >= 10 && hour <= 15 ? 'busy' : 'moderate';
    }
    case 'mall':
    case 'cinema': {
      if (hour >= 16 && hour <= 21) return isWeekend ? 'busy' : 'moderate';
      return hour >= 12 && hour < 16 ? 'moderate' : 'quiet';
    }
    case 'restaurant': {
      const mealRush = (hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 21);
      return mealRush ? 'busy' : 'moderate';
    }
    default:
      return hour >= 10 && hour <= 18 ? 'moderate' : 'quiet';
  }
}

/**
 * Converts a real Google Place into an unconnected ServiceLocation with strictly honest queue fields.
 * Live crowd level, percentage, and queue count remain null until an authorized provider connects.
 */
export function googlePlaceToUnavailableLocation(gp: DiscoveredGooglePlace): ServiceLocation {
  const safePlaceId = makeSafeId(gp.googlePlaceId);
  const generalBusyness = computeGeneralBusyness(gp.category);

  return {
    id: `gp_${safePlaceId}`,
    ownerId: '',
    googlePlaceId: safePlaceId,
    name: gp.name,
    organizationGroup: gp.name,
    category: gp.category,
    address: gp.address,
    lat: gp.lat,
    lng: gp.lng,
    operatingHours: gp.operatingHours || 'Hours available on Google Maps',
    isOpenNow: gp.isOpenNow ?? null,
    businessStatus: gp.businessStatus,
    rating: gp.rating ?? null,
    hasLiveCrowdData: false,
    crowdLevel: null,
    crowdPercentage: null,
    generalBusyness,
    waitingCount: null,
    avgServiceMinutes: 4,
    delayMinutes: 0,
    currentlyServingNumber: null,
    lastTokenSequence: 0,
    currentlyServingCode: null,
    isPaused: false,
    isActive: true,
    dataSource: 'google_places',
    services: ['General Queue', 'Priority Desk'],
    counters: ['Counter 1'],
    imageKey: gp.category,
    photoUrl: gp.photoUrl,
    updatedAtMs: null,
  };
}

/**
 * Fair queue ordering:
 * - Medical emergencies (weight 3) always jump to front among waiting.
 * - Senior / Disability priority (weight 1-2) are interleaved fairly so standard tokens
 *   are not starved: we sort by effective score (sequenceNumber - priorityWeight * 4).
 */
export function sortWaitingQueueFairly(tokens: QueueToken[]): QueueToken[] {
  return [...tokens].sort((a, b) => {
    const aActive = a.status === 'serving' || a.status === 'in_progress';
    const bActive = b.status === 'serving' || b.status === 'in_progress';
    if (aActive && !bActive) return -1;
    if (bActive && !aActive) return 1;
    if (a.priorityTier === 'medical' && b.priorityTier !== 'medical') return -1;
    if (b.priorityTier === 'medical' && a.priorityTier !== 'medical') return 1;

    const scoreA = a.sequenceNumber - a.priorityWeight * 4;
    const scoreB = b.sequenceNumber - b.priorityWeight * 4;
    if (scoreA !== scoreB) return scoreA - scoreB;
    return a.sequenceNumber - b.sequenceNumber;
  });
}

export function computeTokenPosition(
  token: QueueToken,
  activeTokens: QueueToken[],
  location: ServiceLocation
): {
  peopleAhead: number;
  estimatedWaitMinutes: number;
  expectedServiceTimeStr: string;
  progressPercent: number;
} {
  const ordered = sortWaitingQueueFairly(
    activeTokens.filter(
      (t) => t.status === 'waiting' || t.status === 'in_progress' || t.status === 'serving'
    )
  );
  const idx = ordered.findIndex((t) => t.id === token.id);
  const currentlyServingNum = location.currentlyServingNumber ?? 0;
  const isAtCounter = token.status === 'serving' || token.status === 'in_progress';
  const peopleAhead = isAtCounter
    ? 0
    : idx >= 0
    ? ordered.slice(0, idx).filter((t) => t.status === 'waiting').length
    : Math.max(0, token.sequenceNumber - currentlyServingNum - 1);

  const activeCounters = Math.max(1, location.counters.length);
  const perPersonMinutes = location.avgServiceMinutes / activeCounters;
  const estimatedWaitMinutes = isAtCounter
    ? 0
    : Math.max(1, Math.round(peopleAhead * perPersonMinutes + location.delayMinutes));

  const targetTime = new Date(Date.now() + estimatedWaitMinutes * 60_000);
  const expectedServiceTimeStr = targetTime.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const totalSpan = Math.max(1, peopleAhead + Math.max(1, currentlyServingNum > 0 ? 5 : 1));
  const progressPercent = isAtCounter
    ? 100
    : Math.min(96, Math.max(8, Math.round(((totalSpan - peopleAhead) / totalSpan) * 100)));

  return {
    peopleAhead,
    estimatedWaitMinutes,
    expectedServiceTimeStr,
    progressPercent,
  };
}

export function haversineDistanceKm(a: LatLngLiteral, b: LatLngLiteral): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const calc =
    sinLat * sinLat + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return R * 2 * Math.atan2(Math.sqrt(calc), Math.sqrt(1 - calc));
}

export function estimateTravelMinutes(distanceKm: number): number {
  return Math.max(2, Math.round((distanceKm / 24) * 60));
}

export function computeLocationWaitMinutes(loc: ServiceLocation): number | null {
  if (!loc.hasLiveCrowdData || loc.waitingCount === null) return null;
  const counters = Math.max(1, loc.counters.length);
  return Math.max(1, Math.round((loc.waitingCount * loc.avgServiceMinutes) / counters + loc.delayMinutes));
}

export function formatRelativeTime(timestampMs: number | null): string {
  if (!timestampMs) return 'Live unavailable';
  const diffSec = Math.max(0, Math.floor((Date.now() - timestampMs) / 1000));
  if (diffSec < 60) return 'Just now';
  const mins = Math.floor(diffSec / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export async function triggerBrowserNotification(title: string, body: string, tag?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration('/firebase-messaging-sw.js');
      if (reg && typeof reg.showNotification === 'function') {
        await reg.showNotification(title, {
          body,
          tag: tag || 'qlite-queue-alert',
          badge: '/favicon.ico',
        });
        return;
      }
    }
    new Notification(title, { body, tag: tag || 'qlite-queue-alert' });
  } catch {
    // Ignore if blocked in sandboxed iframe
  }
}
