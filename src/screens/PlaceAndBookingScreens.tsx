import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bookmark,
  Clock,
  ExternalLink,
  GitBranch,
  Info,
  MapPin,
  Navigation,
  PlusCircle,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';
import { TranslationBundle } from '../i18n/translations';
import {
  computeLocationWaitMinutes,
  estimateTravelMinutes,
  formatRelativeTime,
  haversineDistanceKm,
} from '../lib/queueEngine';
import {
  LatLngLiteral,
  PriorityTier,
  QueueToken,
  RouteEstimate,
  ServiceLocation,
} from '../types/qlite';
import { CrowdIndicator } from '../components/CrowdBadge';
import { VenueImage } from '../components/VenueImage';

interface PlaceDetailsScreenProps {
  location: ServiceLocation;
  allLocations: ServiceLocation[];
  userCenter: LatLngLiteral;
  isFavorite: boolean;
  existingActiveToken: QueueToken | null;
  routeEstimate: RouteEstimate | null;
  t: TranslationBundle;
  onBack: () => void;
  onToggleFavorite: () => void;
  onStartBooking: () => void;
  onConnectLiveQueue: (loc: ServiceLocation) => void;
  onSelectOtherBranch: (loc: ServiceLocation) => void;
  onOpenLiveQueue: () => void;
  onOpenExploreWithRoute: () => void;
}

export function PlaceDetailsScreen({
  location,
  allLocations,
  userCenter,
  isFavorite,
  existingActiveToken,
  routeEstimate,
  t,
  onBack,
  onToggleFavorite,
  onStartBooking,
  onConnectLiveQueue,
  onSelectOtherBranch,
  onOpenLiveQueue,
  onOpenExploreWithRoute,
}: PlaceDetailsScreenProps) {
  const waitMins = computeLocationWaitMinutes(location);
  const distKm = haversineDistanceKm(userCenter, { lat: location.lat, lng: location.lng });
  const travelMins = routeEstimate?.durationMinutes ?? estimateTravelMinutes(distKm);

  const alternativeBranches = useMemo(() => {
    return allLocations
      .filter(
        (l) =>
          l.id !== location.id &&
          (l.category === location.category || l.organizationGroup === location.organizationGroup)
      )
      .sort((a, b) => {
        if (a.hasLiveCrowdData !== b.hasLiveCrowdData) return a.hasLiveCrowdData ? -1 : 1;
        const distA = haversineDistanceKm(userCenter, { lat: a.lat, lng: a.lng });
        const distB = haversineDistanceKm(userCenter, { lat: b.lat, lng: b.lng });
        return distA - distB;
      })
      .slice(0, 4);
  }, [allLocations, location, userCenter]);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-2 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back</span>
        </button>

        <button
          type="button"
          onClick={onToggleFavorite}
          className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs font-semibold inline-flex items-center gap-1.5 transition-colors ${
            isFavorite
              ? 'bg-blue-50 border-blue-200 text-blue-800'
              : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          <Bookmark className="w-4 h-4" />
          <span>{isFavorite ? t.place.savedFavorite : t.place.saveFavorite}</span>
        </button>
      </div>

      {/* Main Place Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="relative">
          <VenueImage
            photoUrl={location.photoUrl}
            imageKey={location.imageKey}
            category={location.category}
            name={location.name}
            className="h-52 sm:h-64 w-full"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-4 left-5 right-5 flex flex-wrap items-end justify-between gap-3 text-white">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-blue-100">
                <span className="font-semibold">{t.categories[location.category]}</span>
                {location.isOpenNow !== undefined && location.isOpenNow !== null && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                        location.isOpenNow
                          ? 'bg-emerald-500/25 text-emerald-100 border border-emerald-400/40'
                          : 'bg-red-500/25 text-red-100 border border-red-400/40'
                      }`}
                    >
                      {location.isOpenNow ? t.home.openNow : t.home.closed}
                    </span>
                  </>
                )}
                {typeof location.rating === 'number' && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-amber-300">
                      <Star className="w-3.5 h-3.5 fill-amber-300 text-amber-300" />
                      {location.rating.toFixed(1)}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white text-balance drop-shadow-xs">
                {location.name}
              </h1>
            </div>

            <CrowdIndicator
              level={location.crowdLevel}
              label={location.crowdLevel ? t.crowd[location.crowdLevel] : t.crowd.unavailable}
              percentage={location.crowdPercentage}
            />
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-slate-500">
              <span
                className={
                  location.hasLiveCrowdData
                    ? 'text-emerald-700 font-semibold'
                    : 'text-slate-600 font-medium'
                }
              >
                {location.hasLiveCrowdData ? t.dataSource.live_provider : t.dataSource.google_places}
              </span>
              {location.hasLiveCrowdData && location.updatedAtMs && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    {t.place.updated} {formatRelativeTime(location.updatedAtMs)}
                  </span>
                </>
              )}
              {!location.hasLiveCrowdData && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-slate-500">{t.dataSource.unavailable}</span>
                </>
              )}
            </div>

            <p className="text-sm text-slate-700 flex items-start gap-1.5">
              <MapPin className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <span>{location.address}</span>
            </p>

            <p className="text-xs text-slate-400 font-mono tabular-nums">
              {t.place.gpsCoordinates}: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </p>
          </div>

          {/* Metrics Grid — Strictly verified live queue data or honest Unavailable state */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <p className="text-xs text-slate-500 mb-1">{t.place.crowdPercentage}</p>
              {location.hasLiveCrowdData && location.crowdPercentage !== null ? (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-900 font-mono tabular-nums">
                    {location.crowdPercentage}%
                  </p>
                  <CrowdIndicator
                    compact
                    level={location.crowdLevel}
                    label={location.crowdLevel ? t.crowd[location.crowdLevel] : t.crowd.unavailable}
                  />
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-lg font-bold text-slate-400 font-mono tabular-nums">—</p>
                  <p className="text-[11px] text-slate-500">{t.crowd.unavailable}</p>
                </div>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <p className="text-xs text-slate-500 mb-1">{t.place.peopleWaiting}</p>
              {location.hasLiveCrowdData && location.waitingCount !== null ? (
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-700" />
                  {location.waitingCount}
                </p>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-400 font-mono tabular-nums flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />—
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.dataSource.unavailable}</p>
                </>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <p className="text-xs text-slate-500 mb-1">{t.place.estWait}</p>
              {location.hasLiveCrowdData && waitMins !== null ? (
                <p className="text-lg font-bold text-slate-900 font-mono tabular-nums flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-700" />
                  ~{waitMins} {t.place.mins}
                </p>
              ) : (
                <>
                  <p className="text-lg font-bold text-slate-400 font-mono tabular-nums flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-400" />—
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{t.dataSource.unavailable}</p>
                </>
              )}
            </div>

            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5">
              <p className="text-xs text-slate-500 mb-1">{t.place.travelEta}</p>
              <p className="text-lg font-bold text-slate-900 font-mono tabular-nums flex items-center gap-1.5">
                <Navigation className="w-4 h-4 text-blue-700" />
                {travelMins} {t.place.mins}
              </p>
              <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                {distKm.toFixed(1)} km
              </p>
            </div>
          </div>

          {/* Honest Distinction: General Busyness vs Verified Service Queue */}
          {!location.hasLiveCrowdData && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <Activity className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    {t.dataSource.generalBusynessTitle}
                  </p>
                  <p className="text-xs font-semibold text-blue-800">
                    {location.generalBusyness
                      ? t.busyness[location.generalBusyness]
                      : t.busyness.moderate}
                  </p>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    {t.dataSource.generalBusynessHint}
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50/70 border border-blue-200/80 flex items-start gap-3">
                <Info className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-slate-900">
                    {t.place.liveDataUnavailable}
                  </p>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {t.place.liveRequiredNote}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Operating Hours & Live Counter Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
            <div>
              <p className="text-xs font-semibold text-slate-500 mb-1">{t.place.hours}</p>
              <p className="text-sm text-slate-800">{location.operatingHours}</p>
            </div>
            {location.hasLiveCrowdData ? (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">{t.place.counters}</p>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {location.counters.join(' · ')} · Currently serving{' '}
                  <span className="font-mono font-semibold text-blue-700">
                    {location.currentlyServingCode ?? 'T-000'}
                  </span>
                </p>
              </div>
            ) : (
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1">Google Place ID</p>
                <p className="text-xs font-mono text-slate-600 truncate">
                  {location.googlePlaceId || location.id}
                </p>
              </div>
            )}
          </div>

          {location.hasLiveCrowdData && (
            <>
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-1.5">{t.place.services}</p>
                <p className="text-sm text-slate-800 leading-relaxed">
                  {location.services.join(' · ')}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-slate-900">{t.place.priorityRulesTitle}</p>
                  <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                    {t.place.priorityRulesBody}
                  </p>
                </div>
              </div>
            </>
          )}

          {/* Primary Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            {!location.hasLiveCrowdData ? (
              <button
                type="button"
                onClick={() => onConnectLiveQueue(location)}
                className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2"
              >
                <PlusCircle className="w-4 h-4" />
                <span>{t.place.connectLiveQueue}</span>
              </button>
            ) : existingActiveToken && existingActiveToken.locationId === location.id ? (
              <button
                type="button"
                onClick={onOpenLiveQueue}
                className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-emerald-700 text-white text-sm font-semibold hover:bg-emerald-800 transition-colors"
              >
                {t.place.alreadyInQueue} ({existingActiveToken.tokenCode})
              </button>
            ) : (
              <button
                type="button"
                disabled={location.isPaused}
                onClick={onStartBooking}
                className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600 transition-colors"
              >
                {location.isPaused ? t.place.queuePaused : t.place.joinQueue}
              </button>
            )}

            <button
              type="button"
              onClick={onOpenExploreWithRoute}
              className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <Navigation className="w-4 h-4 text-blue-700" />
              <span>Route Preview</span>
            </button>

            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${location.lat},${location.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[48px] px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm font-semibold hover:bg-slate-50 transition-colors inline-flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4 text-slate-500" />
              <span>{t.place.getDirections}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Nearby Same-Category Branches / Venues */}
      {alternativeBranches.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-blue-700" />
            <h2 className="text-base font-bold text-slate-900">{t.place.otherBranches}</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {alternativeBranches.map((alt) => {
              const altWait = computeLocationWaitMinutes(alt);
              const altDist = haversineDistanceKm(userCenter, { lat: alt.lat, lng: alt.lng });
              const faster = altWait !== null && waitMins !== null && altWait < waitMins;
              return (
                <div
                  key={alt.id}
                  className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-slate-900">{alt.name}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 tabular-nums">
                      <CrowdIndicator
                        compact
                        level={alt.crowdLevel}
                        label={alt.crowdLevel ? t.crowd[alt.crowdLevel] : t.crowd.unavailable}
                        percentage={alt.crowdPercentage}
                      />
                      <span aria-hidden="true">·</span>
                      <span>
                        {alt.hasLiveCrowdData && alt.waitingCount !== null
                          ? `${alt.waitingCount} waiting`
                          : t.dataSource.unavailable}
                      </span>
                      {altWait !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-semibold text-slate-800">
                            ~{altWait} {t.place.mins}
                          </span>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{altDist.toFixed(1)} km</span>
                      {faster && waitMins !== null && altWait !== null && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-700 font-semibold">
                            {waitMins - altWait} min faster
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectOtherBranch(alt)}
                    className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 whitespace-nowrap shrink-0 transition-colors"
                  >
                    {t.home.viewDetails}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

interface BookingScreenProps {
  location: ServiceLocation;
  userCenter: LatLngLiteral;
  existingActiveToken: QueueToken | null;
  busy: boolean;
  t: TranslationBundle;
  onBack: () => void;
  onConfirmBooking: (
    serviceName: string,
    slotLabel: string,
    priorityTier: PriorityTier
  ) => Promise<void>;
}

const PRIORITY_TIERS: PriorityTier[] = ['standard', 'senior', 'disability', 'medical'];

export function BookingScreen({
  location,
  userCenter,
  existingActiveToken,
  busy,
  t,
  onBack,
  onConfirmBooking,
}: BookingScreenProps) {
  const [selectedService, setSelectedService] = useState(location.services[0] || 'General Queue');
  const [selectedSlot, setSelectedSlot] = useState(t.booking.nowWalkIn);
  const [priorityTier, setPriorityTier] = useState<PriorityTier>('standard');
  const [error, setError] = useState('');

  const timeSlots = useMemo(() => {
    const now = new Date();
    const formatPlus = (mins: number) => {
      const d = new Date(now.getTime() + mins * 60_000);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };
    return [
      t.booking.nowWalkIn,
      `Today · ${formatPlus(30)}`,
      `Today · ${formatPlus(60)}`,
      `Today · ${formatPlus(120)}`,
    ];
  }, [t.booking.nowWalkIn]);

  const waitMins = computeLocationWaitMinutes(location) ?? 0;
  const distKm = haversineDistanceKm(userCenter, { lat: location.lat, lng: location.lng });
  const travelMins = estimateTravelMinutes(distKm);
  const mayExpireBeforeArrival = selectedSlot === t.booking.nowWalkIn && travelMins > Math.max(5, waitMins);
  const isDuplicate = existingActiveToken?.locationId === location.id;

  const estServiceTime = new Date(Date.now() + waitMins * 60_000).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await onConfirmBooking(selectedService, selectedSlot, priorityTier);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to generate token.');
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 inline-flex items-center gap-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back</span>
      </button>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs"
      >
        <div className="smart-navy-hero text-white px-6 py-5">
          <p className="text-xs font-semibold text-blue-200">{t.booking.title}</p>
          <h1 className="text-xl font-bold text-white mt-1">{location.name}</h1>
          {location.hasLiveCrowdData ? (
            <p className="text-xs text-blue-100 mt-1 font-mono tabular-nums">
              {location.waitingCount ?? 0} waiting · ~{waitMins} {t.place.mins} ·{' '}
              {t.booking.estimatedServiceTime}: {estServiceTime}
            </p>
          ) : (
            <p className="text-xs text-amber-200 mt-1 font-medium">{t.place.liveRequiredNote}</p>
          )}
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          {isDuplicate && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{t.booking.duplicateWarning}</span>
            </div>
          )}

          {mayExpireBeforeArrival && location.hasLiveCrowdData && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                {t.booking.lateWarning} ({travelMins} min travel vs. ~{waitMins} min wait — consider picking a later slot).
              </span>
            </div>
          )}

          {/* 1. Service */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-slate-900">
              {t.booking.selectService}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {location.services.map((srv) => {
                const active = selectedService === srv;
                return (
                  <button
                    key={srv}
                    type="button"
                    onClick={() => setSelectedService(srv)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      active
                        ? 'border-blue-700 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {srv}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Slot */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-slate-900">
              {t.booking.selectSlot}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {timeSlots.map((slot) => {
                const active = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    type="button"
                    onClick={() => setSelectedSlot(slot)}
                    className={`min-h-[44px] px-3.5 py-2.5 rounded-xl border text-left text-sm font-medium transition-colors ${
                      active
                        ? 'border-blue-700 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {slot}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Priority */}
          <div className="space-y-2.5">
            <label className="block text-sm font-bold text-slate-900">
              {t.booking.priorityTier}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {PRIORITY_TIERS.map((tier) => {
                const active = priorityTier === tier;
                return (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setPriorityTier(tier)}
                    className={`min-h-[56px] px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                      active
                        ? 'border-blue-700 bg-blue-50 text-blue-950'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="text-sm font-semibold">{t.priority[tier].label}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{t.priority[tier].desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {error && <p className="text-xs font-semibold text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={busy || isDuplicate || location.isPaused || !location.hasLiveCrowdData}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:bg-slate-300 disabled:text-slate-600 transition-colors"
          >
            {busy ? 'Generating Token...' : t.booking.confirmBooking}
          </button>
        </div>
      </form>
    </div>
  );
}
