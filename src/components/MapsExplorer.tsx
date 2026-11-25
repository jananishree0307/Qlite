/// <reference types="google.maps" />
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
  useMapsLibrary,
} from '@vis.gl/react-google-maps';
import { Compass, ExternalLink, LocateFixed, MapPin, Navigation, Search, X } from 'lucide-react';
import { TranslationBundle } from '../i18n/translations';
import {
  computeIsOpenNow,
  computeLocationWaitMinutes,
  estimateTravelMinutes,
  haversineDistanceKm,
  mapGooglePlaceTypesToCategory,
} from '../lib/queueEngine';
import {
  DiscoveredGooglePlace,
  LatLngLiteral,
  RouteEstimate,
  ServiceLocation,
  makeSafeId,
} from '../types/qlite';
import { CategoryIcon } from './CategoryIcon';
import { CrowdIndicator, getCrowdPinColor } from './CrowdBadge';

export const MAPS_API_KEY = (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) || '';

function dispatchQuotaErrorIfNeeded(err: unknown) {
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

interface PlacesAutocompleteBoxProps {
  placeholder: string;
  userCenter: LatLngLiteral;
  onSelectPlace: (place: DiscoveredGooglePlace) => void;
}

export function PlacesAutocompleteBox({
  placeholder,
  userCenter,
  onSelectPlace,
}: PlacesAutocompleteBoxProps) {
  const placesLib = useMapsLibrary('places');
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.AutocompleteSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!placesLib || !query.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new placesLib.AutocompleteSessionToken();
        }
        setLoading(true);
        const res = await placesLib.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(),
          sessionToken: sessionTokenRef.current,
          locationBias: {
            center: userCenter,
            radius: 50000,
          },
        });
        setSuggestions(res.suggestions || []);
      } catch (err) {
        dispatchQuotaErrorIfNeeded(err);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [placesLib, query, userCenter]);

  const handleChoose = async (suggestion: google.maps.places.AutocompleteSuggestion) => {
    if (!suggestion.placePrediction) return;
    try {
      const place = suggestion.placePrediction.toPlace();
      await place.fetchFields({
        fields: [
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
        ],
      });
      sessionTokenRef.current = null;
      setSuggestions([]);
      setQuery('');
      if (place.location) {
        let photoUrl: string | undefined;
        try {
          if (place.photos && place.photos.length > 0) {
            photoUrl = place.photos[0].getURI({ maxWidth: 640 });
          }
        } catch {
          photoUrl = undefined;
        }
        const jsDay = new Date().getDay();
        const googleIdx = jsDay === 0 ? 6 : jsDay - 1;
        const hours = place.regularOpeningHours?.weekdayDescriptions?.[googleIdx];

        onSelectPlace({
          googlePlaceId: makeSafeId(place.id || `gp_${Date.now()}`),
          name: place.displayName || suggestion.placePrediction.text.text,
          address: place.formattedAddress || 'Address available on Google Maps',
          lat: place.location.lat(),
          lng: place.location.lng(),
          category: mapGooglePlaceTypesToCategory(place.primaryType, place.types),
          operatingHours: hours,
          isOpenNow: computeIsOpenNow(
            place.businessStatus,
            place.regularOpeningHours,
            place.utcOffsetMinutes
          ),
          businessStatus: place.businessStatus || undefined,
          rating: typeof place.rating === 'number' ? place.rating : null,
          photoUrl,
        });
      }
    } catch (err) {
      dispatchQuotaErrorIfNeeded(err);
    }
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 min-h-[44px] bg-white border border-slate-200 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 shadow-xs"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setSuggestions([]);
            }}
            aria-label="Clear search"
            className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {(suggestions.length > 0 || loading) && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-64 overflow-y-auto divide-y divide-slate-100">
          {loading && (
            <div className="px-4 py-2.5 text-xs text-slate-500">Searching Google Places...</div>
          )}
          {suggestions.map((s, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleChoose(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-slate-50 transition-colors flex items-start gap-2.5 min-h-[44px]"
            >
              <MapPin className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <span className="text-sm text-slate-800 line-clamp-2">
                {s.placePrediction?.text.text}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface RouteOverlayProps {
  origin: LatLngLiteral;
  destination: LatLngLiteral | null;
  onRouteComputed: (estimate: RouteEstimate | null) => void;
}

function RouteOverlay({ origin, destination, onRouteComputed }: RouteOverlayProps) {
  const map = useMap();
  const routesLib = useMapsLibrary('routes');
  const polylinesRef = useRef<google.maps.Polyline[]>([]);

  useEffect(() => {
    polylinesRef.current.forEach((p) => p.setMap(null));
    polylinesRef.current = [];

    if (!map || !routesLib || !destination) {
      onRouteComputed(null);
      return;
    }

    let cancelled = false;

    const run = async () => {
      try {
        const res = await routesLib.Route.computeRoutes({
          origin,
          destination,
          travelMode: routesLib.TravelMode.DRIVING,
          fields: ['durationMillis', 'distanceMeters', 'path', 'viewport'],
        });

        if (cancelled) return;
        const route = res.routes?.[0];
        if (route) {
          const lines = route.createPolylines({
            polylineOptions: {
              strokeColor: '#1D4ED8',
              strokeOpacity: 0.92,
              strokeWeight: 5,
            },
          });
          lines.forEach((line) => line.setMap(map));
          polylinesRef.current = lines;

          if (route.viewport) {
            map.fitBounds(route.viewport, 48);
          }

          const durationMinutes = Math.max(
            1,
            Math.round((route.durationMillis || 0) / 60000)
          );
          onRouteComputed({
            distanceMeters: route.distanceMeters || 0,
            durationMinutes,
            source: 'google_routes',
          });
        }
      } catch (err) {
        dispatchQuotaErrorIfNeeded(err);
        if (!cancelled) {
          const km = haversineDistanceKm(origin, destination);
          onRouteComputed({
            distanceMeters: Math.round(km * 1000),
            durationMinutes: estimateTravelMinutes(km),
            source: 'haversine_estimate',
          });
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      polylinesRef.current.forEach((p) => p.setMap(null));
      polylinesRef.current = [];
    };
  }, [map, routesLib, origin, destination, onRouteComputed]);

  return null;
}

function getZoomForRadiusKm(radiusKm?: number): number {
  if (!radiusKm || radiusKm <= 1) return 15;
  if (radiusKm <= 3) return 14;
  if (radiusKm <= 5) return 13;
  if (radiusKm <= 10) return 12;
  return 11;
}

interface VenueMarkerProps {
  location: ServiceLocation;
  userCenter: LatLngLiteral;
  isSelected: boolean;
  t: TranslationBundle;
  onSelect: (loc: ServiceLocation | null) => void;
  onOpenDetails: (loc: ServiceLocation) => void;
}

function VenueMarker({
  location,
  userCenter,
  isSelected,
  t,
  onSelect,
  onOpenDetails,
}: VenueMarkerProps) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const colors = getCrowdPinColor(location.crowdLevel);
  const waitMins = computeLocationWaitMinutes(location);
  const distKm = haversineDistanceKm(userCenter, { lat: location.lat, lng: location.lng });

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: location.lat, lng: location.lng }}
        title={location.name}
        zIndex={isSelected ? 40 : location.hasLiveCrowdData ? 25 : 10}
        onClick={() => onSelect(location)}
      >
        <div
          className={`flex flex-col items-center transition-transform ${
            isSelected ? 'scale-125' : 'hover:scale-110'
          }`}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2"
            style={{ backgroundColor: colors.bg, borderColor: '#FFFFFF' }}
          >
            <CategoryIcon category={location.category} className="w-4 h-4" />
          </div>
          <div
            className="w-2.5 h-2.5 -mt-1.5 rotate-45 border-r border-b border-white"
            style={{ backgroundColor: colors.bg }}
          />
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow anchor={marker} maxWidth={310} onCloseClick={() => onSelect(null)}>
          <div className="p-1.5 font-sans space-y-2">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-blue-700">
                  {t.categories[location.category]} · {distKm.toFixed(1)} km
                </p>
                <p className="text-sm font-bold text-slate-900 leading-snug">
                  {location.name}
                </p>
              </div>
              {location.isOpenNow !== null && location.isOpenNow !== undefined && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    location.isOpenNow
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-red-50 text-red-700'
                  }`}
                >
                  {location.isOpenNow ? t.home.openNow : t.home.closed}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-600 leading-snug line-clamp-2">{location.address}</p>

            <CrowdIndicator
              compact
              level={location.crowdLevel}
              label={location.crowdLevel ? t.crowd[location.crowdLevel] : t.crowd.unavailable}
              percentage={location.crowdPercentage}
            />

            {location.hasLiveCrowdData ? (
              <p className="text-xs text-slate-700 tabular-nums">
                <span className="font-semibold">{location.waitingCount ?? 0}</span> {t.place.peopleWaiting} · ~
                <span className="font-semibold">{waitMins ?? 0}</span> {t.place.mins}
              </p>
            ) : (
              <p className="text-[11px] text-slate-500">
                {location.generalBusyness ? t.busyness[location.generalBusyness] : t.dataSource.google_places} ·{' '}
                {t.dataSource.unavailable}
              </p>
            )}

            <p className="text-[10px] font-mono tabular-nums text-slate-400">
              {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
            </p>

            <div className="flex items-center gap-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => onOpenDetails(location)}
                className="flex-1 py-1.5 px-3 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                {location.hasLiveCrowdData ? t.place.joinQueue : t.home.viewDetails}
              </button>
              <a
                href={`https://www.google.com/maps/dir/?api=1&origin=${userCenter.lat},${userCenter.lng}&destination=${location.lat},${location.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="py-1.5 px-2.5 rounded-lg border border-slate-200 text-blue-700 hover:bg-blue-50 text-xs font-semibold inline-flex items-center gap-1 shrink-0"
                title={t.place.getDirections}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>Directions</span>
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface MapsExplorerProps {
  locations: ServiceLocation[];
  userCenter: LatLngLiteral;
  radiusKm?: number;
  selectedLocation: ServiceLocation | null;
  showRouteToSelected: boolean;
  t: TranslationBundle;
  onSelectLocation: (loc: ServiceLocation | null) => void;
  onOpenDetails: (loc: ServiceLocation) => void;
  onRouteComputed?: (est: RouteEstimate | null) => void;
  onPlaceDiscovered?: (place: DiscoveredGooglePlace) => void;
  onMoveArea?: (place: DiscoveredGooglePlace) => void;
}

function MapCanvasInner({
  locations,
  userCenter,
  radiusKm = 10,
  selectedLocation,
  showRouteToSelected,
  t,
  onSelectLocation,
  onOpenDetails,
  onRouteComputed = () => {},
  onPlaceDiscovered,
  onMoveArea,
}: MapsExplorerProps) {
  const status = useApiLoadingStatus();
  const map = useMap();
  const [discoveredPlace, setDiscoveredPlace] = useState<DiscoveredGooglePlace | null>(null);
  const lastUserCenterRef = useRef<LatLngLiteral>(userCenter);
  const lastRadiusRef = useRef<number>(radiusKm);

  useEffect(() => {
    if (!map) return;
    const prev = lastUserCenterRef.current;
    if (prev.lat !== userCenter.lat || prev.lng !== userCenter.lng) {
      lastUserCenterRef.current = userCenter;
      setDiscoveredPlace(null);
      map.panTo(userCenter);
      if (!showRouteToSelected) {
        map.setZoom(getZoomForRadiusKm(radiusKm));
      }
    }
  }, [map, userCenter.lat, userCenter.lng, radiusKm, showRouteToSelected]);

  useEffect(() => {
    if (!map) return;
    if (lastRadiusRef.current !== radiusKm) {
      lastRadiusRef.current = radiusKm;
      if (!showRouteToSelected) {
        map.panTo(userCenter);
        map.setZoom(getZoomForRadiusKm(radiusKm));
      }
    }
  }, [map, radiusKm, userCenter, showRouteToSelected]);

  useEffect(() => {
    if (map && selectedLocation) {
      map.panTo({ lat: selectedLocation.lat, lng: selectedLocation.lng });
    }
  }, [map, selectedLocation?.id]);

  const handlePlaceSelect = useCallback(
    (place: DiscoveredGooglePlace) => {
      setDiscoveredPlace(place);
      if (map) {
        map.panTo({ lat: place.lat, lng: place.lng });
        map.setZoom(15);
      }
      onPlaceDiscovered?.(place);
    },
    [map, onPlaceDiscovered]
  );

  if (status === APILoadingStatus.FAILED || status === APILoadingStatus.AUTH_FAILURE) {
    return (
      <div className="w-full h-full min-h-[380px] rounded-2xl border border-slate-200 bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <Compass className="w-8 h-8 text-slate-400 mb-2" />
        <p className="text-sm font-medium text-slate-800">Interactive Map Unavailable</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Unable to load Google Maps tiles right now. You can still browse all detected venues and open external Google Maps directions.
        </p>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full min-h-[380px] rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
      <div className="absolute top-3 left-3 right-14 z-20 max-w-md flex items-center gap-2">
        <div className="flex-1">
          <PlacesAutocompleteBox
            placeholder={t.home.whereToGo}
            userCenter={userCenter}
            onSelectPlace={handlePlaceSelect}
          />
        </div>
        <button
          type="button"
          onClick={() => {
            if (map) {
              map.panTo(userCenter);
              map.setZoom(getZoomForRadiusKm(radiusKm));
            }
          }}
          title="Center map on current location"
          aria-label="Center map on current location"
          className="h-11 w-11 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-blue-700 hover:bg-slate-50 shadow-xs flex items-center justify-center shrink-0"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      </div>

      <GoogleMap
        mapId="DEMO_MAP_ID"
        defaultCenter={userCenter}
        defaultZoom={getZoomForRadiusKm(radiusKm)}
        gestureHandling="greedy"
        disableDefaultUI={false}
        internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
        style={{ width: '100%', height: '100%', minHeight: '380px' }}
      >
        {/* User current GPS marker */}
        <AdvancedMarker position={userCenter} title="Your Current Location">
          <div className="relative flex items-center justify-center">
            <span className="w-8 h-8 rounded-full bg-blue-500/25 animate-ping absolute" />
            <span className="w-7 h-7 rounded-full bg-blue-500/20 absolute" />
            <div className="w-4 h-4 rounded-full bg-blue-700 border-2 border-white shadow-md" />
          </div>
        </AdvancedMarker>

        {/* Real-World Service Location Markers */}
        {locations.map((loc) => (
          <VenueMarker
            key={loc.id}
            location={loc}
            userCenter={userCenter}
            isSelected={selectedLocation?.id === loc.id}
            t={t}
            onSelect={onSelectLocation}
            onOpenDetails={onOpenDetails}
          />
        ))}

        {/* Discovered Google Place marker */}
        {discoveredPlace && (
          <AdvancedMarker
            position={{ lat: discoveredPlace.lat, lng: discoveredPlace.lng }}
            title={discoveredPlace.name}
          >
            <Pin background="#1D4ED8" borderColor="#1E3A8A" glyphColor="#FFFFFF" />
          </AdvancedMarker>
        )}

        {showRouteToSelected && selectedLocation && (
          <RouteOverlay
            origin={userCenter}
            destination={{ lat: selectedLocation.lat, lng: selectedLocation.lng }}
            onRouteComputed={onRouteComputed}
          />
        )}
      </GoogleMap>

      {discoveredPlace && (
        <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm bg-white border border-slate-200 rounded-xl p-3 shadow-lg z-20 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-700">Google Place Found</p>
              <p className="text-sm font-semibold text-slate-900 truncate">{discoveredPlace.name}</p>
              <p className="text-xs text-slate-500 truncate">{discoveredPlace.address}</p>
            </div>
            <button
              type="button"
              onClick={() => setDiscoveredPlace(null)}
              className="p-1 text-slate-400 hover:text-slate-600 shrink-0"
              aria-label="Close discovered place"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {onMoveArea && (
            <button
              type="button"
              onClick={() => {
                onMoveArea(discoveredPlace);
                setDiscoveredPlace(null);
              }}
              className="w-full py-1.5 px-3 rounded-lg bg-blue-50 text-blue-800 text-xs font-semibold hover:bg-blue-100 transition-colors"
            >
              Search Nearby Places Here
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function MapsExplorer(props: MapsExplorerProps) {
  if (!MAPS_API_KEY) {
    return (
      <div className="w-full h-full min-h-[380px] rounded-2xl border border-slate-200 bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <Navigation className="w-8 h-8 text-blue-700 mb-2" />
        <p className="text-sm font-semibold text-slate-900">Google Maps View Ready</p>
        <p className="text-xs text-slate-600 mt-1 max-w-sm">
          Add <code className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200">VITE_GOOGLE_MAPS_API_KEY</code> to display live interactive maps, category pins, and nearby places.
        </p>
        {props.selectedLocation && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${props.selectedLocation.lat},${props.selectedLocation.lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-medium hover:bg-blue-800 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            {props.t.place.getDirections}
          </a>
        )}
      </div>
    );
  }

  return <MapCanvasInner {...props} />;
}
