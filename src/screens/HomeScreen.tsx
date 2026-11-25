import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  Compass,
  ExternalLink,
  History,
  LocateFixed,
  MapPin,
  Navigation,
  Radio,
  RefreshCw,
  Search,
  Star,
  Ticket,
  Users,
} from 'lucide-react';
import { HERO_CITY_IMAGE_PATH } from '../data/seedLocations';
import { TranslationBundle } from '../i18n/translations';
import {
  computeLocationWaitMinutes,
  formatRelativeTime,
  haversineDistanceKm,
} from '../lib/queueEngine';
import {
  DiscoveredGooglePlace,
  LatLngLiteral,
  QueueToken,
  RecentlyViewedLocation,
  ServiceCategory,
  ServiceLocation,
} from '../types/qlite';
import { CategoryIcon } from '../components/CategoryIcon';
import { CrowdIndicator } from '../components/CrowdBadge';
import { MAPS_API_KEY, PlacesAutocompleteBox } from '../components/MapsExplorer';
import { VenueImage } from '../components/VenueImage';

const CATEGORY_LIST: (ServiceCategory | 'all')[] = [
  'all',
  'temple',
  'hospital',
  'bank',
  'mall',
  'cinema',
  'post_office',
  'government',
  'retail',
  'restaurant',
  'college',
];

const RADIUS_OPTIONS_KM = [1, 3, 5, 10, 20];

export type GpsPermissionStatus = 'detecting' | 'granted' | 'denied' | 'error' | 'unsupported';

interface HomeScreenProps {
  userName?: string | null;
  locations: ServiceLocation[];
  recentlyViewed: RecentlyViewedLocation[];
  userCenter: LatLngLiteral;
  gpsActive: boolean;
  gpsPermission: GpsPermissionStatus;
  gpsAccuracyMeters?: number | null;
  areaLabel: string | null;
  category: ServiceCategory | 'all';
  radiusKm: number;
  nearbyLoading: boolean;
  nearbyError: string | null;
  nearbyUpdatedAtMs?: number | null;
  activeToken: QueueToken | null;
  t: TranslationBundle;
  onCategoryChange: (cat: ServiceCategory | 'all') => void;
  onRadiusChange: (km: number) => void;
  onRequestGps: () => void;
  onMoveArea: (place: DiscoveredGooglePlace) => void;
  onRefreshNearby: () => void;
  onSearchPlacesByText?: (query: string) => Promise<void>;
  onSelectLocation: (loc: ServiceLocation) => void;
  onSelectGooglePlace: (place: DiscoveredGooglePlace) => void;
  onOpenLocationOnMap: (loc: ServiceLocation) => void;
  onOpenLiveQueue: () => void;
  onOpenExplore: () => void;
  onJoinOrConnectLocation: (loc: ServiceLocation) => void;
}

function getTimeGreeting(t: TranslationBundle): string {
  const hr = new Date().getHours();
  if (hr < 12) return t.home.greetingMorning;
  if (hr < 17) return t.home.greetingAfternoon;
  return t.home.greetingEvening;
}

function deriveShortAreaName(locations: ServiceLocation[], userCenter: LatLngLiteral): string | null {
  const nearest = [...locations]
    .map((loc) => ({ loc, dist: haversineDistanceKm(userCenter, { lat: loc.lat, lng: loc.lng }) }))
    .filter((item) => item.dist <= 25)
    .sort((a, b) => a.dist - b.dist)[0]?.loc;
  if (!nearest?.address) return null;
  const parts = nearest.address
    .split(',')
    .map((p) => p.trim())
    .filter((p) => p.length > 2 && !/^\d{5,6}$/.test(p));
  if (parts.length >= 3) {
    return `${parts[parts.length - 3]}, ${parts[parts.length - 2]}`;
  }
  if (parts.length >= 2) {
    return parts.slice(0, 2).join(', ');
  }
  return parts[0] || null;
}

export function HomeScreen({
  userName,
  locations,
  recentlyViewed,
  userCenter,
  gpsActive,
  gpsPermission,
  gpsAccuracyMeters,
  areaLabel,
  category,
  radiusKm,
  nearbyLoading,
  nearbyError,
  nearbyUpdatedAtMs,
  activeToken,
  t,
  onCategoryChange,
  onRadiusChange,
  onRequestGps,
  onMoveArea,
  onRefreshNearby,
  onSearchPlacesByText,
  onSelectLocation,
  onSelectGooglePlace,
  onOpenLocationOnMap,
  onOpenLiveQueue,
  onOpenExplore,
  onJoinOrConnectLocation,
}: HomeScreenProps) {
  const [search, setSearch] = useState('');
  const [showAreaChanger, setShowAreaChanger] = useState(false);

  const greeting = getTimeGreeting(t);
  const resolvedArea = useMemo(
    () => areaLabel || deriveShortAreaName(locations, userCenter),
    [areaLabel, locations, userCenter]
  );

  const enriched = useMemo(() => {
    return locations
      .map((loc) => {
        const distKm = haversineDistanceKm(userCenter, { lat: loc.lat, lng: loc.lng });
        const waitMins = computeLocationWaitMinutes(loc);
        return { loc, distKm, waitMins };
      })
      .sort((a, b) => {
        if (a.distKm <= radiusKm && b.distKm <= radiusKm && a.loc.hasLiveCrowdData !== b.loc.hasLiveCrowdData) {
          return a.loc.hasLiveCrowdData ? -1 : 1;
        }
        return a.distKm - b.distKm;
      });
  }, [locations, userCenter, radiusKm]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const maxDist = q ? Math.max(radiusKm, 25) : radiusKm;
    return enriched.filter(({ loc, distKm }) => {
      const inRadius = distKm <= maxDist + 0.3;
      const catMatch = category === 'all' || loc.category === category;
      const textMatch =
        !q ||
        loc.name.toLowerCase().includes(q) ||
        loc.address.toLowerCase().includes(q) ||
        loc.organizationGroup.toLowerCase().includes(q) ||
        loc.services.some((s) => s.toLowerCase().includes(q));
      return inRadius && catMatch && textMatch;
    });
  }, [enriched, category, search, radiusKm]);

  useEffect(() => {
    const q = search.trim();
    if (!q || q.length < 2 || !onSearchPlacesByText || !MAPS_API_KEY) return;
    if (filtered.length >= 3) return;
    const timer = setTimeout(() => {
      void onSearchPlacesByText(q);
    }, 380);
    return () => clearTimeout(timer);
  }, [search, filtered.length, onSearchPlacesByText]);

  const displayedPlaces = filtered;

  // Live crowd highlights: strictly connected live_provider venues near current location
  const liveHighlights = useMemo(() => {
    return enriched
      .filter(({ loc, distKm }) => loc.hasLiveCrowdData && !loc.isPaused && distKm <= Math.max(radiusKm, 25))
      .sort((a, b) => (a.waitMins ?? 999) - (b.waitMins ?? 999))
      .slice(0, 4);
  }, [enriched, radiusKm]);

  const recentlyViewedResolved = useMemo(() => {
    return recentlyViewed
      .map((item) => {
        const liveOrCached = locations.find(
          (l) => l.id === item.id || (item.googlePlaceId && l.googlePlaceId === item.googlePlaceId)
        );
        const distKm = haversineDistanceKm(userCenter, { lat: item.lat, lng: item.lng });
        return { item, liveOrCached, distKm };
      })
      .slice(0, 8);
  }, [recentlyViewed, locations, userCenter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-6">
      {/* Smart-City Deep Navy Welcome & Search Hero */}
      <section className="smart-navy-hero relative overflow-hidden rounded-3xl text-white shadow-lg border border-blue-900/40">
        <img
          src={HERO_CITY_IMAGE_PATH}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity pointer-events-none"
        />
        <div className="relative z-10 p-5 sm:p-7 space-y-5">
          {/* Greeting + Current GPS Row */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                {greeting}
                {userName ? `, ${userName}` : ''}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-balance">
                {t.home.whereToGo}
              </h1>
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100">
                <span
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold ${
                    areaLabel
                      ? 'bg-blue-500/25 text-white border border-blue-300/30'
                      : gpsActive && gpsPermission === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-100 border border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-100 border border-amber-300/30'
                  }`}
                >
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {areaLabel
                      ? `Area: ${areaLabel}`
                      : gpsPermission === 'detecting'
                      ? 'Detecting live GPS...'
                      : gpsActive && gpsPermission === 'granted'
                      ? `${resolvedArea ? `${resolvedArea} · ` : ''}${t.home.gpsActive}${
                          gpsAccuracyMeters ? ` (±${Math.round(gpsAccuracyMeters)}m)` : ''
                        }`
                      : resolvedArea
                      ? `${resolvedArea} · ${t.home.gpsFallback}`
                      : t.home.gpsFallback}
                  </span>
                </span>
                <span className="font-mono tabular-nums text-[11px] text-blue-200">
                  {userCenter.lat.toFixed(4)}, {userCenter.lng.toFixed(4)}
                </span>
                {MAPS_API_KEY && (
                  <button
                    type="button"
                    onClick={() => setShowAreaChanger((v) => !v)}
                    className="text-xs font-semibold text-blue-200 hover:text-white underline underline-offset-4 ml-1"
                  >
                    Change Area
                  </button>
                )}
              </div>
            </div>

            {/* Hero Primary Actions */}
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={onRequestGps}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-xs border border-white/20 text-white text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <LocateFixed className="w-4 h-4 text-blue-200" />
                <span>
                  {gpsPermission === 'detecting'
                    ? 'Detecting GPS...'
                    : areaLabel
                    ? 'Use My Live GPS'
                    : t.home.refreshLocation}
                </span>
              </button>
              <button
                type="button"
                onClick={onOpenExplore}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-white text-blue-900 hover:bg-blue-50 text-xs font-bold inline-flex items-center gap-2 shadow-sm transition-colors whitespace-nowrap"
              >
                <Compass className="w-4 h-4 text-blue-700" />
                <span>{t.home.exploreNearby}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Search Bar & Google Place Quick Jump */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-slate-900">
            <div className={MAPS_API_KEY ? 'lg:col-span-7 relative flex items-center' : 'lg:col-span-12 relative flex items-center'}>
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t.home.searchPlaceholder}
                className="w-full pl-10 pr-4 py-2.5 min-h-[46px] rounded-xl border border-white/20 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-400 shadow-xs"
              />
            </div>

            {MAPS_API_KEY && (
              <div className="lg:col-span-5">
                <PlacesAutocompleteBox
                  placeholder="Jump to any Google Maps place or city..."
                  userCenter={userCenter}
                  onSelectPlace={onSelectGooglePlace}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Active Digital Token Summary Banner */}
      {activeToken && (
        <section className="bg-white border border-blue-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 rounded-2xl bg-blue-700 text-white flex items-center justify-center shrink-0">
              <Ticket className="w-6 h-6" />
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-xs font-semibold text-blue-700">
                {t.home.activeTokenBanner} · {t.status[activeToken.status]}
              </p>
              <div className="flex items-baseline gap-2.5">
                <span className="text-xl font-extrabold font-mono tabular-nums text-slate-950">
                  {activeToken.tokenCode}
                </span>
                <span className="text-sm font-semibold text-slate-700 truncate">
                  {activeToken.locationName}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLiveQueue}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
          >
            <span>{t.home.viewLiveQueue}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </section>
      )}

      {/* Location Permission / Area Switcher Alert */}
      {(gpsPermission === 'denied' ||
        gpsPermission === 'error' ||
        gpsPermission === 'unsupported' ||
        showAreaChanger) && (
        <section className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-amber-950">
                  {gpsPermission === 'denied'
                    ? 'Location permission is blocked in your browser'
                    : gpsPermission === 'error'
                    ? 'Unable to lock live GPS signal right now'
                    : gpsPermission === 'unsupported'
                    ? 'GPS geolocation is unavailable on this device'
                    : 'Move to another neighborhood or city'}
                </p>
                <p className="text-xs text-amber-900">
                  {gpsPermission === 'denied'
                    ? 'Allow location access in browser site settings and click Retry GPS, or search any area/city below to dynamically load real places there.'
                    : gpsPermission === 'error'
                    ? 'Check device location settings and click Retry GPS, or choose any area below.'
                    : 'Search any neighborhood or city to dynamically load real nearby places via Google Places Nearby Search.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRequestGps}
                className="min-h-[38px] px-3 py-1.5 rounded-xl bg-amber-900 text-white text-xs font-semibold hover:bg-amber-950 inline-flex items-center gap-1.5"
              >
                <LocateFixed className="w-3.5 h-3.5" />
                <span>Retry GPS</span>
              </button>
              {showAreaChanger && (
                <button
                  type="button"
                  onClick={() => setShowAreaChanger(false)}
                  className="min-h-[38px] px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-900 text-xs font-semibold"
                >
                  Close
                </button>
              )}
            </div>
          </div>

          {MAPS_API_KEY && (
            <div className="max-w-md">
              <PlacesAutocompleteBox
                placeholder="Search any area or city..."
                userCenter={userCenter}
                onSelectPlace={(place) => {
                  onMoveArea(place);
                  setShowAreaChanger(false);
                }}
              />
            </div>
          )}
        </section>
      )}

      {/* Quick Service Categories */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-slate-900">{t.home.categoriesTitle}</h2>
          {category !== 'all' && (
            <button
              type="button"
              onClick={() => onCategoryChange('all')}
              className="text-xs font-semibold text-blue-700 hover:underline"
            >
              {t.home.allCategories}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2.5 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORY_LIST.map((cat) => {
            const active = category === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 transition-all ${
                  active
                    ? 'bg-blue-700 border-blue-700 text-white shadow-xs'
                    : 'bg-white border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50/40'
                }`}
              >
                {cat !== 'all' && (
                  <CategoryIcon
                    category={cat}
                    className={`w-4 h-4 ${active ? 'text-white' : 'text-blue-700'}`}
                  />
                )}
                <span>{cat === 'all' ? t.home.allCategories : t.categories[cat]}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Live Crowd Highlights (Connected Live Queue Venues) */}
      {liveHighlights.length > 0 && !search && category === 'all' && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" />
              <span>{t.home.liveHighlightsTitle}</span>
            </h2>
            <span className="text-xs font-medium text-emerald-700">
              {t.dataSource.live_provider}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {liveHighlights.map(({ loc, distKm, waitMins }) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => onSelectLocation(loc)}
                className="text-left bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-400 transition-all shadow-2xs flex flex-col justify-between gap-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CrowdIndicator
                      compact
                      level={loc.crowdLevel}
                      label={loc.crowdLevel ? t.crowd[loc.crowdLevel] : t.crowd.unavailable}
                      percentage={loc.crowdPercentage}
                    />
                    <span className="text-xs text-slate-500 tabular-nums font-medium">
                      {distKm.toFixed(1)} km
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 line-clamp-1">
                    {loc.name}
                  </h3>
                  <p className="text-xs text-slate-500 line-clamp-1">{loc.address}</p>
                </div>

                <div className="flex items-center justify-between pt-2.5 border-t border-slate-100 text-xs">
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {loc.waitingCount ?? 0} waiting · ~{waitMins ?? 0} {t.place.mins}
                  </span>
                  <span className="text-blue-700 font-semibold whitespace-nowrap">
                    {t.place.joinQueue} →
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recently Viewed Places Rail */}
      {recentlyViewedResolved.length > 0 && !search && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <History className="w-4 h-4 text-blue-700" />
              <span>{t.home.recentlyViewedTitle}</span>
            </h2>
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-1 no-scrollbar">
            {recentlyViewedResolved.map(({ item, liveOrCached, distKm }) => {
              const targetLoc = liveOrCached;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    if (targetLoc) {
                      onSelectLocation(targetLoc);
                    } else {
                      onSelectGooglePlace({
                        googlePlaceId: item.googlePlaceId || item.id.replace(/^gp_/, ''),
                        name: item.name,
                        address: item.address,
                        lat: item.lat,
                        lng: item.lng,
                        category: item.category,
                        photoUrl: item.photoUrl,
                        isOpenNow: item.isOpenNow,
                      });
                    }
                  }}
                  className="w-64 shrink-0 text-left bg-white border border-slate-200 rounded-2xl p-3.5 hover:border-blue-400 transition-colors flex items-center gap-3"
                >
                  <VenueImage
                    photoUrl={targetLoc?.photoUrl || item.photoUrl}
                    category={item.category}
                    name={item.name}
                    className="w-14 h-14 rounded-xl shrink-0"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">{item.name}</p>
                    <p className="text-[11px] text-slate-500">
                      {t.categories[item.category]} · {distKm.toFixed(1)} km
                    </p>
                    {targetLoc?.hasLiveCrowdData ? (
                      <p className="text-[11px] font-semibold text-emerald-700">
                        {t.dataSource.live_provider}
                      </p>
                    ) : item.isOpenNow !== null && item.isOpenNow !== undefined ? (
                      <p
                        className={`text-[11px] font-semibold ${
                          item.isOpenNow ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        {item.isOpenNow ? t.home.openNow : t.home.closed}
                      </p>
                    ) : null}
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Nearby Real-World Popular Places Grid */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-lg font-bold text-slate-900">{t.home.nearbyPlaces}</h2>
            {nearbyLoading ? (
              <span className="text-xs text-blue-700 font-medium">{t.home.detectingPlaces}</span>
            ) : nearbyUpdatedAtMs ? (
              <span className="text-[11px] text-slate-400">
                · {formatRelativeTime(nearbyUpdatedAtMs)}
              </span>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Radius quick selector: 1, 3, 5, 10, 20 km */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-xl p-1 gap-0.5">
              {RADIUS_OPTIONS_KM.map((km) => (
                <button
                  key={km}
                  type="button"
                  onClick={() => onRadiusChange(km)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                    radiusKm === km
                      ? 'bg-blue-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {km} km
                </button>
              ))}
            </div>

            {MAPS_API_KEY && (
              <button
                type="button"
                onClick={onRefreshNearby}
                disabled={nearbyLoading}
                className="min-h-[36px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${nearbyLoading ? 'animate-spin' : ''}`} />
                <span>{t.home.refreshNearby}</span>
              </button>
            )}

            <span className="text-xs text-slate-500 tabular-nums">
              {displayedPlaces.length} places
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-500 leading-relaxed">{t.dataSource.gpsDisclaimer}</p>

        {nearbyError && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
            {nearbyError}
          </div>
        )}

        {displayedPlaces.length === 0 ? (
          <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
            <p className="text-sm font-medium text-slate-700">
              {nearbyLoading
                ? t.home.detectingPlaces
                : !MAPS_API_KEY
                ? 'Add a Google Maps API key or connect a verified venue in Staff Desk to discover nearby places.'
                : `No ${category === 'all' ? 'places' : t.categories[category].toLowerCase()} found within ${radiusKm} km of ${
                    resolvedArea || 'your current coordinates'
                  }.`}
            </p>
            {MAPS_API_KEY && !nearbyLoading && (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {radiusKm < 20 && (
                  <button
                    type="button"
                    onClick={() => onRadiusChange(radiusKm < 10 ? 10 : 20)}
                    className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
                  >
                    Expand Radius to {radiusKm < 10 ? 10 : 20} km
                  </button>
                )}
                {category !== 'all' && (
                  <button
                    type="button"
                    onClick={() => onCategoryChange('all')}
                    className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold hover:bg-slate-100"
                  >
                    {t.home.allCategories}
                  </button>
                )}
                <button
                  type="button"
                  onClick={onRefreshNearby}
                  className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-blue-700 text-xs font-semibold hover:bg-slate-50"
                >
                  {t.home.refreshNearby}
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayedPlaces.map(({ loc, distKm, waitMins }) => (
              <div
                key={loc.id}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-blue-400 transition-all shadow-2xs flex flex-col"
              >
                <div
                  onClick={() => onSelectLocation(loc)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectLocation(loc);
                    }
                  }}
                  className="relative cursor-pointer"
                >
                  <VenueImage
                    photoUrl={loc.photoUrl}
                    imageKey={loc.imageKey}
                    category={loc.category}
                    name={loc.name}
                    className="h-40 w-full"
                  />
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    {typeof loc.rating === 'number' && (
                      <span className="px-2 py-1 rounded-full text-[11px] font-bold bg-slate-950/80 text-amber-300 inline-flex items-center gap-1 shadow-xs">
                        <Star className="w-3 h-3 fill-amber-300 text-amber-300" />
                        <span className="tabular-nums">{loc.rating.toFixed(1)}</span>
                      </span>
                    )}
                    {loc.isOpenNow !== null && loc.isOpenNow !== undefined && (
                      <span
                        className={`px-2.5 py-1 rounded-full text-[11px] font-bold shadow-xs ${
                          loc.isOpenNow
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-900/85 text-white'
                        }`}
                      >
                        {loc.isOpenNow ? t.home.openNow : t.home.closed}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between gap-3.5">
                  <div
                    onClick={() => onSelectLocation(loc)}
                    className="space-y-1.5 cursor-pointer"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1.5 truncate">
                        <CategoryIcon category={loc.category} className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                        <span className="font-medium">{t.categories[loc.category]}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums font-semibold text-slate-700">
                          {distKm.toFixed(1)} km
                        </span>
                      </span>
                      <span
                        className={`text-[11px] shrink-0 font-semibold ${
                          loc.hasLiveCrowdData ? 'text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {loc.hasLiveCrowdData
                          ? t.dataSource.live_provider
                          : t.dataSource.google_places}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug line-clamp-1">
                      {loc.name}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-2">{loc.address}</p>
                    <p className="text-[11px] font-mono tabular-nums text-slate-400">
                      {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                    </p>
                  </div>

                  {/* Honest Crowd & Queue Info */}
                  <div className="pt-3 border-t border-slate-100 space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <CrowdIndicator
                          compact
                          level={loc.crowdLevel}
                          label={loc.crowdLevel ? t.crowd[loc.crowdLevel] : t.crowd.unavailable}
                          percentage={loc.crowdPercentage}
                        />
                        {loc.hasLiveCrowdData && loc.updatedAtMs && (
                          <span className="text-[11px] text-slate-400 whitespace-nowrap">
                            {formatRelativeTime(loc.updatedAtMs)}
                          </span>
                        )}
                      </div>

                      {loc.hasLiveCrowdData ? (
                        <div className="flex items-center gap-4 text-xs text-slate-700 tabular-nums">
                          <span className="inline-flex items-center gap-1 font-medium">
                            <Users className="w-3.5 h-3.5 text-blue-700" />
                            {loc.waitingCount ?? 0} waiting
                          </span>
                          <span className="inline-flex items-center gap-1 font-bold text-slate-900">
                            <Clock className="w-3.5 h-3.5 text-blue-700" />
                            ~{waitMins ?? 0} {t.place.mins}
                          </span>
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500">
                          {loc.generalBusyness ? t.busyness[loc.generalBusyness] : t.dataSource.generalBusynessHint}
                        </p>
                      )}
                    </div>

                    {/* View Details + Join Queue / Connect + Map/Directions */}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => onSelectLocation(loc)}
                        className="flex-1 min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold hover:bg-slate-100 transition-colors whitespace-nowrap"
                      >
                        {t.home.viewDetails}
                      </button>

                      <button
                        type="button"
                        disabled={loc.hasLiveCrowdData && loc.isPaused}
                        onClick={() => onJoinOrConnectLocation(loc)}
                        className={`flex-1 min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                          loc.hasLiveCrowdData
                            ? 'bg-blue-700 text-white hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600'
                            : 'bg-slate-900 text-white hover:bg-slate-800'
                        }`}
                      >
                        {loc.hasLiveCrowdData
                          ? loc.isPaused
                            ? t.staff.pausedBadge
                            : t.place.joinQueue
                          : t.place.connectLiveQueue}
                      </button>

                      <button
                        type="button"
                        onClick={() => onOpenLocationOnMap(loc)}
                        title="Show on Map"
                        aria-label="Show on Map"
                        className="min-h-[40px] w-10 rounded-xl border border-slate-200 text-slate-600 hover:text-blue-700 hover:bg-slate-50 flex items-center justify-center shrink-0"
                      >
                        <MapPin className="w-4 h-4" />
                      </button>

                      <a
                        href={`https://www.google.com/maps/dir/?api=1&origin=${userCenter.lat},${userCenter.lng}&destination=${loc.lat},${loc.lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={t.place.getDirections}
                        aria-label={t.place.getDirections}
                        className="min-h-[40px] w-10 rounded-xl border border-slate-200 text-blue-700 hover:bg-blue-50 flex items-center justify-center shrink-0"
                      >
                        <Navigation className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
