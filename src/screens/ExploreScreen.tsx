import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  ExternalLink,
  List,
  LocateFixed,
  Map as MapIcon,
  MapPin,
  Navigation,
  PlusCircle,
  RefreshCw,
  Users,
} from 'lucide-react';
import { TranslationBundle } from '../i18n/translations';
import {
  computeLocationWaitMinutes,
  formatRelativeTime,
  haversineDistanceKm,
} from '../lib/queueEngine';
import {
  DiscoveredGooglePlace,
  LatLngLiteral,
  RouteEstimate,
  ServiceCategory,
  ServiceLocation,
} from '../types/qlite';
import { CategoryIcon } from '../components/CategoryIcon';
import { CrowdIndicator } from '../components/CrowdBadge';
import { MAPS_API_KEY, MapsExplorer, PlacesAutocompleteBox } from '../components/MapsExplorer';
import { GpsPermissionStatus } from './HomeScreen';

const CATEGORIES: (ServiceCategory | 'all')[] = [
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

interface ExploreScreenProps {
  locations: ServiceLocation[];
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
  initialSelectedLocation: ServiceLocation | null;
  initialShowRoute?: boolean;
  t: TranslationBundle;
  onCategoryChange: (cat: ServiceCategory | 'all') => void;
  onRadiusChange: (km: number) => void;
  onRequestGps: () => void;
  onMoveArea: (place: DiscoveredGooglePlace) => void;
  onRefreshNearby: () => void;
  onOpenDetails: (loc: ServiceLocation) => void;
  onSelectDiscoveredPlace: (place: DiscoveredGooglePlace) => void;
  onQuickRegisterGooglePlace?: (place: DiscoveredGooglePlace) => void;
}

export function ExploreScreen({
  locations,
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
  initialSelectedLocation,
  initialShowRoute = false,
  t,
  onCategoryChange,
  onRadiusChange,
  onRequestGps,
  onMoveArea,
  onRefreshNearby,
  onOpenDetails,
  onSelectDiscoveredPlace,
  onQuickRegisterGooglePlace,
}: ExploreScreenProps) {
  const [selectedLoc, setSelectedLoc] = useState<ServiceLocation | null>(
    initialSelectedLocation || null
  );
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'list'>('split');
  const [showRoute, setShowRoute] = useState(initialShowRoute);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [discovered, setDiscovered] = useState<DiscoveredGooglePlace | null>(null);
  const [showAreaChanger, setShowAreaChanger] = useState(false);

  const sortedAll = useMemo(() => {
    return locations
      .map((loc) => ({
        loc,
        distKm: haversineDistanceKm(userCenter, { lat: loc.lat, lng: loc.lng }),
        waitMins: computeLocationWaitMinutes(loc),
      }))
      .sort((a, b) => {
        if (a.distKm <= radiusKm && b.distKm <= radiusKm && a.loc.hasLiveCrowdData !== b.loc.hasLiveCrowdData) {
          return a.loc.hasLiveCrowdData ? -1 : 1;
        }
        return a.distKm - b.distKm;
      });
  }, [locations, userCenter, radiusKm]);

  const filtered = useMemo(() => {
    return sortedAll.filter(
      ({ loc, distKm }) => distKm <= radiusKm + 0.3 && (category === 'all' || loc.category === category)
    );
  }, [sortedAll, category, radiusKm]);

  useEffect(() => {
    if (initialSelectedLocation) {
      const stillNear =
        haversineDistanceKm(userCenter, {
          lat: initialSelectedLocation.lat,
          lng: initialSelectedLocation.lng,
        }) <= Math.max(radiusKm, 25);
      if (stillNear) {
        setSelectedLoc(initialSelectedLocation);
        return;
      }
    }
    if (filtered.length > 0) {
      const stillPresent = selectedLoc && filtered.some((f) => f.loc.id === selectedLoc.id);
      if (!stillPresent) {
        setSelectedLoc(filtered[0].loc);
      }
    } else {
      setSelectedLoc(null);
    }
  }, [initialSelectedLocation, filtered, selectedLoc, userCenter, radiusKm]);

  const showMapPane = viewMode === 'split' || viewMode === 'map';
  const showListPane = viewMode === 'split' || viewMode === 'list';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      {/* Top Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900">{t.nav.explore}</h1>
              {nearbyUpdatedAtMs && !nearbyLoading && (
                <span className="text-[11px] text-slate-400">
                  · {formatRelativeTime(nearbyUpdatedAtMs)}
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-600" />
                {t.crowd.low}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
                {t.crowd.moderate}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                {t.crowd.high}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600" />
                {t.crowd.very_high}
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-500" />
                {t.crowd.unavailable}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-1 flex flex-wrap items-center gap-1.5">
              <span>
                {areaLabel
                  ? `Area: ${areaLabel}`
                  : gpsActive && gpsPermission === 'granted'
                  ? `Live GPS${gpsAccuracyMeters ? ` (±${Math.round(gpsAccuracyMeters)}m)` : ''}`
                  : gpsPermission === 'detecting'
                  ? 'Detecting GPS...'
                  : 'Default Preview Area'}{' '}
                · {userCenter.lat.toFixed(4)}, {userCenter.lng.toFixed(4)}
              </span>
              {MAPS_API_KEY && (
                <button
                  type="button"
                  onClick={() => setShowAreaChanger((v) => !v)}
                  className="font-sans text-blue-700 font-semibold hover:underline"
                >
                  Change Area
                </button>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Map / List / Split Toggle */}
            <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
              <button
                type="button"
                onClick={() => setViewMode('split')}
                className={`hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'split'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{t.explore.splitView}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'map'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <MapIcon className="w-3.5 h-3.5" />
                <span>{t.explore.mapView}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  viewMode === 'list'
                    ? 'bg-white text-blue-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>{t.explore.listView}</span>
              </button>
            </div>

            {MAPS_API_KEY && (
              <button
                type="button"
                onClick={onRefreshNearby}
                disabled={nearbyLoading}
                className="min-h-[38px] px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-blue-700 hover:bg-slate-50 inline-flex items-center gap-1.5 disabled:opacity-50 whitespace-nowrap"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${nearbyLoading ? 'animate-spin' : ''}`} />
                <span>{t.home.refreshNearby}</span>
              </button>
            )}

            <button
              type="button"
              onClick={onRequestGps}
              className={`min-h-[38px] px-3 py-1.5 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                gpsActive && !areaLabel
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <LocateFixed className="w-4 h-4" />
              <span>
                {gpsPermission === 'detecting'
                  ? 'Detecting...'
                  : gpsActive && !areaLabel
                  ? t.home.gpsActive
                  : areaLabel
                  ? 'Use My Live GPS'
                  : t.home.detectGps}
              </span>
            </button>

            {selectedLoc && (
              <button
                type="button"
                onClick={() => setShowRoute((prev) => !prev)}
                className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap ${
                  showRoute
                    ? 'bg-blue-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-800 hover:bg-slate-50'
                }`}
              >
                <Navigation className="w-3.5 h-3.5" />
                <span>{showRoute ? 'Hide Route' : 'Show Route'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Radius Filter Strip (1, 3, 5, 10, 20 km) & Category Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => onCategoryChange(cat)}
                className={`min-h-[36px] px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors inline-flex items-center gap-1.5 ${
                  category === cat
                    ? 'bg-blue-700 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {cat !== 'all' && <CategoryIcon category={cat} className="w-3.5 h-3.5" />}
                <span>{cat === 'all' ? t.home.allCategories : t.categories[cat]}</span>
              </button>
            ))}
          </div>

          <div className="inline-flex items-center bg-slate-100 rounded-xl p-1 gap-0.5 shrink-0 w-fit">
            <span className="text-[11px] font-semibold text-slate-500 px-2">
              {t.explore.radiusLabel}:
            </span>
            {RADIUS_OPTIONS_KM.map((km) => (
              <button
                key={km}
                type="button"
                onClick={() => onRadiusChange(km)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                  radiusKm === km
                    ? 'bg-blue-700 text-white'
                    : 'text-slate-700 hover:bg-white'
                }`}
              >
                {km} km
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Permission / Switch Area Panel */}
      {(gpsPermission === 'denied' ||
        gpsPermission === 'error' ||
        gpsPermission === 'unsupported' ||
        showAreaChanger) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-2.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-950">
                {gpsPermission === 'denied'
                  ? 'Location permission denied. Enable browser location and click Retry GPS, or search any area/city to view real nearby places there.'
                  : gpsPermission === 'error'
                  ? 'GPS signal unavailable right now. Click Retry GPS or search any neighborhood or city below.'
                  : 'Search any neighborhood or city to jump the map and fetch nearby places dynamically.'}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onRequestGps}
                className="px-3 py-1.5 rounded-lg bg-amber-900 text-white text-xs font-semibold shrink-0"
              >
                Retry GPS
              </button>
              {showAreaChanger && (
                <button
                  type="button"
                  onClick={() => setShowAreaChanger(false)}
                  className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-amber-900 text-xs font-semibold"
                >
                  Close
                </button>
              )}
            </div>
          </div>
          {MAPS_API_KEY && (
            <div className="max-w-md">
              <PlacesAutocompleteBox
                placeholder="Move to any area or city..."
                userCenter={userCenter}
                onSelectPlace={(place) => {
                  onMoveArea(place);
                  setShowAreaChanger(false);
                }}
              />
            </div>
          )}
        </div>
      )}

      {nearbyError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-900">
          {nearbyError}
        </div>
      )}

      {/* Map + List Split / Focused Layout */}
      <div
        className={`grid grid-cols-1 gap-4 items-stretch ${
          viewMode === 'split' ? 'lg:grid-cols-12' : ''
        }`}
      >
        {showMapPane && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-7 h-[420px] lg:h-[600px]' : 'h-[560px]'
            } flex flex-col gap-2`}
          >
            <MapsExplorer
              locations={filtered.map((f) => f.loc)}
              userCenter={userCenter}
              radiusKm={radiusKm}
              selectedLocation={selectedLoc}
              showRouteToSelected={showRoute}
              t={t}
              onSelectLocation={(loc) => setSelectedLoc(loc)}
              onOpenDetails={onOpenDetails}
              onRouteComputed={setRouteEstimate}
              onPlaceDiscovered={setDiscovered}
              onMoveArea={onMoveArea}
            />

            {showRoute && routeEstimate && selectedLoc && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs text-blue-950">
                <span>
                  Route to <strong>{selectedLoc.name}</strong>:{' '}
                  <span className="font-mono font-semibold tabular-nums">
                    {(routeEstimate.distanceMeters / 1000).toFixed(1)} km · ~{routeEstimate.durationMinutes} min
                  </span>
                </span>
                <span className="text-blue-700 font-medium">
                  {routeEstimate.source === 'google_routes' ? 'Google Routes' : 'Est. Distance'}
                </span>
              </div>
            )}

            {discovered && (
              <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="truncate">
                  <span className="font-semibold text-slate-900">{discovered.name}</span>
                  <span className="text-slate-500 ml-2">{discovered.address}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => onSelectDiscoveredPlace(discovered)}
                    className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 font-semibold hover:bg-slate-200"
                  >
                    {t.home.viewDetails}
                  </button>
                  {onQuickRegisterGooglePlace && (
                    <button
                      type="button"
                      onClick={() => onQuickRegisterGooglePlace(discovered)}
                      className="px-3 py-1.5 rounded-lg bg-blue-700 text-white font-semibold inline-flex items-center gap-1 hover:bg-blue-800"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>{t.place.connectLiveQueue}</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {showListPane && (
          <div
            className={`${
              viewMode === 'split' ? 'lg:col-span-5 max-h-[600px]' : ''
            } bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col shadow-2xs`}
          >
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <span className="text-sm font-bold text-slate-900">{t.home.nearbyPlaces}</span>
              <span className="text-xs text-slate-500 tabular-nums">
                {nearbyLoading ? 'Updating...' : `${filtered.length} within ${radiusKm} km`}
              </span>
            </div>

            <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
              {filtered.length === 0 ? (
                <div className="p-8 text-center space-y-3">
                  <p className="text-xs font-medium text-slate-600">
                    {nearbyLoading
                      ? t.home.detectingPlaces
                      : `No ${category === 'all' ? 'places' : t.categories[category].toLowerCase()} found within ${radiusKm} km.`}
                  </p>
                  {!nearbyLoading && (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {radiusKm < 20 && (
                        <button
                          type="button"
                          onClick={() => onRadiusChange(radiusKm < 10 ? 10 : 20)}
                          className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
                        >
                          Expand to {radiusKm < 10 ? 10 : 20} km
                        </button>
                      )}
                      {category !== 'all' && (
                        <button
                          type="button"
                          onClick={() => onCategoryChange('all')}
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200"
                        >
                          {t.home.allCategories}
                        </button>
                      )}
                      {MAPS_API_KEY && (
                        <button
                          type="button"
                          onClick={onRefreshNearby}
                          className="px-3 py-1.5 rounded-lg border border-slate-200 text-blue-700 text-xs font-semibold hover:bg-slate-50"
                        >
                          {t.home.refreshNearby}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                filtered.map(({ loc, distKm, waitMins }) => {
                  const isSelected = selectedLoc?.id === loc.id;
                  return (
                    <div
                      key={loc.id}
                      className={`p-4 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setSelectedLoc(loc)}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                            <CategoryIcon category={loc.category} className="w-3.5 h-3.5 text-blue-700 shrink-0" />
                            <span>{t.categories[loc.category]}</span>
                            {loc.isOpenNow !== null && loc.isOpenNow !== undefined && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span
                                  className={`font-semibold ${
                                    loc.isOpenNow ? 'text-emerald-700' : 'text-red-600'
                                  }`}
                                >
                                  {loc.isOpenNow ? t.home.openNow : t.home.closed}
                                </span>
                              </>
                            )}
                          </div>
                          <p className="text-sm font-bold text-slate-900 truncate">{loc.name}</p>
                          <p className="text-xs text-slate-500 line-clamp-2">{loc.address}</p>
                          <p className="text-[10px] font-mono tabular-nums text-slate-400">
                            {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-slate-700 tabular-nums shrink-0">
                          {distKm.toFixed(1)} km
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs tabular-nums min-w-0">
                          <CrowdIndicator
                            compact
                            level={loc.crowdLevel}
                            label={loc.crowdLevel ? t.crowd[loc.crowdLevel] : t.crowd.unavailable}
                            percentage={loc.crowdPercentage}
                          />
                          {loc.hasLiveCrowdData && (
                            <>
                              <span className="text-slate-700 inline-flex items-center gap-1">
                                <Users className="w-3.5 h-3.5 text-slate-400" />
                                {loc.waitingCount ?? 0}
                              </span>
                              <span className="font-semibold text-slate-900 inline-flex items-center gap-1">
                                <Clock className="w-3.5 h-3.5 text-slate-400" />
                                ~{waitMins ?? 0} {t.place.mins}
                              </span>
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedLoc(loc);
                              setShowRoute(true);
                              if (viewMode === 'list') setViewMode('split');
                            }}
                            title="Show route on map"
                            className="p-2 rounded-lg border border-slate-200 bg-white text-slate-700 hover:text-blue-700 hover:bg-slate-50"
                          >
                            <MapPin className="w-3.5 h-3.5" />
                          </button>
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${userCenter.lat},${userCenter.lng}&destination=${loc.lat},${loc.lng}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            title={t.place.getDirections}
                            className="p-2 rounded-lg border border-slate-200 bg-white text-blue-700 hover:bg-blue-50"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpenDetails(loc);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 whitespace-nowrap"
                          >
                            {t.home.viewDetails}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
