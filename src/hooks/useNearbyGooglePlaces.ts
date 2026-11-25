/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import { useMapsLibrary } from '@vis.gl/react-google-maps';
import {
  computeIsOpenNow,
  haversineDistanceKm,
  mapGooglePlaceTypesToCategory,
} from '../lib/queueEngine';
import {
  DiscoveredGooglePlace,
  LanguageCode,
  LatLngLiteral,
  ServiceCategory,
  makeSafeId,
} from '../types/qlite';

function dispatchQuotaIfNeeded(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  if (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('OVER_QUERY_LIMIT') ||
    msg.includes('429') ||
    msg.includes('Quota')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
}

// Strict Places API (New) Table A place types only
const CATEGORY_GOOGLE_TYPES: Record<ServiceCategory, string[]> = {
  temple: ['hindu_temple', 'church', 'mosque', 'buddhist_temple', 'synagogue'],
  hospital: ['hospital', 'doctor', 'dentist', 'pharmacy'],
  bank: ['bank', 'atm'],
  mall: ['shopping_mall', 'department_store'],
  cinema: ['movie_theater'],
  post_office: ['post_office'],
  government: ['local_government_office', 'city_hall', 'courthouse', 'embassy'],
  retail: ['supermarket', 'grocery_store', 'department_store', 'convenience_store'],
  restaurant: ['restaurant', 'cafe', 'bakery'],
  college: ['university', 'school'],
  other: ['tourist_attraction', 'library', 'museum'],
};

const CATEGORY_TEXT_QUERIES: Record<ServiceCategory, string> = {
  temple: 'temple church mosque place of worship',
  hospital: 'hospital clinic medical center pharmacy',
  bank: 'bank branch atm',
  mall: 'shopping mall center',
  cinema: 'cinema movie theater multiplex',
  post_office: 'post office',
  government: 'government office municipal office',
  retail: 'supermarket grocery retail store',
  restaurant: 'restaurant cafe food court',
  college: 'college university campus',
  other: 'public service center library museum',
};

const PLACE_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'types',
  'regularOpeningHours',
  'businessStatus',
  'utcOffsetMinutes',
  'rating',
  'photos',
];

function extractHoursSummary(place: google.maps.places.Place): string | undefined {
  const desc = place.regularOpeningHours?.weekdayDescriptions;
  if (!desc || desc.length === 0) return undefined;
  const jsDay = new Date().getDay(); // 0 = Sun
  const googleIdx = jsDay === 0 ? 6 : jsDay - 1; // weekdayDescriptions starts Monday
  return desc[googleIdx] || desc[0];
}

function mapPlaceResult(place: google.maps.places.Place): DiscoveredGooglePlace | null {
  if (!place.id || !place.displayName || !place.location) return null;
  let photoUrl: string | undefined;
  try {
    if (place.photos && place.photos.length > 0) {
      photoUrl = place.photos[0].getURI({ maxWidth: 640 });
    }
  } catch {
    photoUrl = undefined;
  }

  return {
    googlePlaceId: makeSafeId(place.id),
    name: place.displayName,
    address: place.formattedAddress || 'Address available on Google Maps',
    lat: place.location.lat(),
    lng: place.location.lng(),
    category: mapGooglePlaceTypesToCategory(place.primaryType, place.types),
    operatingHours: extractHoursSummary(place),
    isOpenNow: computeIsOpenNow(
      place.businessStatus,
      place.regularOpeningHours,
      place.utcOffsetMinutes
    ),
    businessStatus: place.businessStatus || undefined,
    rating: typeof place.rating === 'number' ? place.rating : null,
    photoUrl,
  };
}

export function useNearbyGooglePlaces(
  center: LatLngLiteral,
  categoryFilter: ServiceCategory | 'all',
  language: LanguageCode,
  enabled: boolean,
  radiusKm = 50
) {
  const placesLib = useMapsLibrary('places');
  const [places, setPlaces] = useState<DiscoveredGooglePlace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);
  const lastFetchedCenterRef = useRef<LatLngLiteral | null>(null);

  const refresh = useCallback(() => {
    setReloadTick((n) => n + 1);
  }, []);

  // Optional live text search helper for search bar / sparse-area fallback
  const searchByText = useCallback(
    async (textQuery: string): Promise<DiscoveredGooglePlace[]> => {
      if (!enabled || !placesLib || !textQuery.trim()) return [];
      try {
        const res = await placesLib.Place.searchByText({
          textQuery: textQuery.trim(),
          fields: PLACE_FIELDS,
          locationBias: {
            center,
            radius: Math.min(50000, Math.max(5000, radiusKm * 1000)),
          },
          maxResultCount: 20,
          language,
        });
        const mapped = (res.places || [])
          .map(mapPlaceResult)
          .filter((p): p is DiscoveredGooglePlace => Boolean(p));
        if (mapped.length > 0) {
          setPlaces((prev) => {
            const byId: Record<string, DiscoveredGooglePlace> = {};
            for (const p of prev) byId[p.googlePlaceId] = p;
            for (const p of mapped) byId[p.googlePlaceId] = p;
            return Object.values(byId);
          });
        }
        return mapped;
      } catch (err) {
        dispatchQuotaIfNeeded(err);
        return [];
      }
    },
    [enabled, placesLib, center.lat, center.lng, radiusKm, language]
  );

  useEffect(() => {
    if (!enabled || !placesLib) {
      return;
    }

    let cancelled = false;
    const prevCenter = lastFetchedCenterRef.current;
    const movedFar =
      !prevCenter || haversineDistanceKm(prevCenter, center) >= 1.0;

    if (movedFar) {
      // Clear stale results immediately when user moves to a new neighborhood/city
      setPlaces([]);
    }
    lastFetchedCenterRef.current = center;

    const fetchNearby = async () => {
      setLoading(true);
      setError(null);
      try {
        // Places API (New) searchNearby allows radius up to 50,000 meters (50 km)
        const effectiveRadiusMeters = Math.min(50000, Math.max(1000, radiusKm * 1000));

        // Balanced batches ensure temples, hospitals, post offices, malls, cinemas & banks all surface
        const typeBatches: string[][] =
          categoryFilter === 'all'
            ? [
                [
                  'hindu_temple',
                  'church',
                  'mosque',
                  'hospital',
                  'post_office',
                  'local_government_office',
                ],
                ['shopping_mall', 'movie_theater', 'university', 'supermarket'],
                ['bank', 'restaurant'],
              ]
            : [CATEGORY_GOOGLE_TYPES[categoryFilter]];

        const settled = await Promise.allSettled(
          typeBatches.map((includedTypes) =>
            placesLib.Place.searchNearby({
              fields: PLACE_FIELDS,
              locationRestriction: {
                center,
                radius: effectiveRadiusMeters,
              },
              includedTypes,
              maxResultCount: 20,
              rankPreference: 'DISTANCE',
              language,
            })
          )
        );

        if (cancelled) return;

        const deduped: Record<string, DiscoveredGooglePlace> = {};
        let firstError: unknown = null;

        for (const outcome of settled) {
          if (outcome.status === 'fulfilled') {
            for (const raw of outcome.value.places || []) {
              const mapped = mapPlaceResult(raw);
              if (mapped) {
                deduped[mapped.googlePlaceId] = mapped;
              }
            }
          } else if (!firstError) {
            firstError = outcome.reason;
          }
        }

        // Wide-area mode (> 50km) or empty category fallback: expand with searchByText (soft locationBias)
        if (Object.keys(deduped).length === 0 || radiusKm > 50) {
          const query =
            categoryFilter === 'all'
              ? 'temple hospital post office bank mall cinema supermarket'
              : CATEGORY_TEXT_QUERIES[categoryFilter];
          try {
            const textRes = await placesLib.Place.searchByText({
              textQuery: query,
              fields: PLACE_FIELDS,
              locationBias: {
                center,
                radius: 50000,
              },
              maxResultCount: 20,
              language,
            });
            if (!cancelled) {
              for (const raw of textRes.places || []) {
                const mapped = mapPlaceResult(raw);
                if (mapped) {
                  deduped[mapped.googlePlaceId] = mapped;
                }
              }
            }
          } catch (err) {
            dispatchQuotaIfNeeded(err);
          }
        }

        // Final unfiltered fallback within 50km so nearby places always appear if any exist
        if (Object.keys(deduped).length === 0 && !cancelled) {
          try {
            const anyNearby = await placesLib.Place.searchNearby({
              fields: PLACE_FIELDS,
              locationRestriction: {
                center,
                radius: 50000,
              },
              maxResultCount: 20,
              rankPreference: 'DISTANCE',
              language,
            });
            if (!cancelled) {
              for (const raw of anyNearby.places || []) {
                const mapped = mapPlaceResult(raw);
                if (mapped) {
                  deduped[mapped.googlePlaceId] = mapped;
                }
              }
            }
          } catch (err) {
            dispatchQuotaIfNeeded(err);
            if (!firstError) firstError = err;
          }
        }

        if (cancelled) return;

        const results = Object.values(deduped);
        setPlaces(results);

        if (results.length === 0 && firstError) {
          dispatchQuotaIfNeeded(firstError);
          setError(
            firstError instanceof Error
              ? firstError.message
              : 'Unable to detect nearby Google Places right now.'
          );
        }
      } catch (err) {
        dispatchQuotaIfNeeded(err);
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : 'Unable to detect nearby Google Places right now.'
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchNearby();

    return () => {
      cancelled = true;
    };
  }, [enabled, placesLib, center.lat, center.lng, categoryFilter, language, radiusKm, reloadTick]);

  return {
    places,
    loading: loading || (enabled && !placesLib),
    error,
    refresh,
    searchByText,
  };
}
