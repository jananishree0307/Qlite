import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  CheckCircle2,
  MapPin,
  Megaphone,
  PauseCircle,
  PlayCircle,
  Plus,
  QrCode,
  SkipForward,
  Users,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { TranslationBundle } from '../i18n/translations';
import { computeCrowdLevel, sortWaitingQueueFairly } from '../lib/queueEngine';
import {
  CrowdLevel,
  DiscoveredGooglePlace,
  LatLngLiteral,
  QueueToken,
  ServiceCategory,
  ServiceLocation,
} from '../types/qlite';
import { CrowdIndicator } from '../components/CrowdBadge';
import { MAPS_API_KEY, PlacesAutocompleteBox } from '../components/MapsExplorer';
import { QrCheckInScannerModal } from '../components/QrCheckInScannerModal';

const CATEGORY_OPTIONS: ServiceCategory[] = [
  'hospital',
  'temple',
  'bank',
  'mall',
  'cinema',
  'post_office',
  'government',
  'retail',
  'restaurant',
  'college',
  'other',
];

interface StaffDashboardScreenProps {
  user: User | null;
  managedLocations: ServiceLocation[];
  activeStaffLocation: ServiceLocation | null;
  nearbyGooglePlaces: DiscoveredGooglePlace[];
  prefillPlace: DiscoveredGooglePlace | null;
  staffTokens: QueueToken[];
  userCenter: LatLngLiteral;
  busyAction: string | null;
  t: TranslationBundle;
  onClearPrefillPlace: () => void;
  onSelectStaffLocation: (id: string) => void;
  onOpenAuth: () => void;
  onOpenReports: () => void;
  onRegisterLocation: (input: {
    googlePlaceId?: string;
    name: string;
    organizationGroup: string;
    category: ServiceCategory;
    address: string;
    lat: number;
    lng: number;
    operatingHours: string;
    avgServiceMinutes: number;
    maxCapacity?: number;
    services: string[];
    counters: string[];
  }) => Promise<ServiceLocation>;
  onCallNext: (loc: ServiceLocation, counterName: string) => Promise<void>;
  onCompleteToken: (loc: ServiceLocation, tok: QueueToken) => Promise<void>;
  onSkipToken: (loc: ServiceLocation, tok: QueueToken, reason: string) => Promise<void>;
  onCheckInQr: (
    loc: ServiceLocation,
    rawQrOrCode: string,
    counterName: string
  ) => Promise<{ token: QueueToken; alreadyInProgress: boolean }>;
  onUpdateState: (
    loc: ServiceLocation,
    updates: {
      crowdLevel?: CrowdLevel;
      crowdPercentage?: number;
      waitingCount?: number;
      isPaused?: boolean;
      delayMinutes?: number;
      counters?: string[];
      operatingHours?: string;
    }
  ) => Promise<void>;
}

export function StaffDashboardScreen({
  user,
  managedLocations,
  activeStaffLocation,
  nearbyGooglePlaces,
  prefillPlace,
  staffTokens,
  userCenter,
  busyAction,
  t,
  onClearPrefillPlace,
  onSelectStaffLocation,
  onOpenAuth,
  onOpenReports,
  onRegisterLocation,
  onCallNext,
  onCompleteToken,
  onSkipToken,
  onCheckInQr,
  onUpdateState,
}: StaffDashboardScreenProps) {
  const [showRegisterForm, setShowRegisterForm] = useState(Boolean(prefillPlace));
  const [showQrScanner, setShowQrScanner] = useState(false);
  const [selectedCounter, setSelectedCounter] = useState('');
  const [newCounterInput, setNewCounterInput] = useState('');
  const [skippingTokenId, setSkippingTokenId] = useState<string | null>(null);
  const [skipReason, setSkipReason] = useState('');

  // Registration form fields (pre-filled from genuine Google Place when selected)
  const [regGooglePlaceId, setRegGooglePlaceId] = useState<string | undefined>(
    prefillPlace?.googlePlaceId
  );
  const [regName, setRegName] = useState(prefillPlace?.name || '');
  const [regOrg, setRegOrg] = useState(prefillPlace?.name || '');
  const [regCat, setRegCat] = useState<ServiceCategory>(prefillPlace?.category || 'hospital');
  const [regAddress, setRegAddress] = useState(prefillPlace?.address || '');
  const [regLat, setRegLat] = useState<number>(prefillPlace?.lat ?? userCenter.lat);
  const [regLng, setRegLng] = useState<number>(prefillPlace?.lng ?? userCenter.lng);
  const [regHours, setRegHours] = useState(prefillPlace?.operatingHours || '09:00 AM – 06:00 PM');
  const [regAvgMins, setRegAvgMins] = useState(4);
  const [regMaxCap, setRegMaxCap] = useState(40);
  const [regServices, setRegServices] = useState('General Queue, Priority Desk');
  const [regCounters, setRegCounters] = useState('Counter 1, Counter 2');

  const applyGooglePlaceToForm = (gp: DiscoveredGooglePlace) => {
    setRegGooglePlaceId(gp.googlePlaceId);
    setRegName(gp.name);
    setRegOrg(gp.name);
    setRegCat(gp.category);
    setRegAddress(gp.address);
    setRegLat(gp.lat);
    setRegLng(gp.lng);
    if (gp.operatingHours) setRegHours(gp.operatingHours);
    setShowRegisterForm(true);
  };

  useEffect(() => {
    if (prefillPlace) {
      applyGooglePlaceToForm(prefillPlace);
    }
  }, [prefillPlace]);

  const inProgressTokens = useMemo(
    () =>
      staffTokens
        .filter((tk) => tk.status === 'in_progress' || tk.status === 'serving')
        .sort((a, b) => b.updatedAtMs - a.updatedAtMs),
    [staffTokens]
  );

  const waitingTokens = useMemo(
    () => sortWaitingQueueFairly(staffTokens.filter((tk) => tk.status === 'waiting')),
    [staffTokens]
  );

  const activeCounter = selectedCounter || activeStaffLocation?.counters[0] || 'Counter 1';

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || !regAddress.trim()) return;
    await onRegisterLocation({
      googlePlaceId: regGooglePlaceId,
      name: regName.trim(),
      organizationGroup: regOrg.trim() || regName.trim(),
      category: regCat,
      address: regAddress.trim(),
      lat: regLat,
      lng: regLng,
      operatingHours: regHours.trim() || '09:00 AM – 06:00 PM',
      avgServiceMinutes: Number(regAvgMins) || 4,
      maxCapacity: Number(regMaxCap) || 40,
      services: regServices
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      counters: regCounters
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean),
    });
    setShowRegisterForm(false);
    setRegGooglePlaceId(undefined);
    setRegName('');
    setRegOrg('');
    setRegAddress('');
    onClearPrefillPlace();
  };

  if (!user) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">{t.staff.title}</h1>
          <p className="text-sm text-slate-600">{t.staff.unauthorizedNote}</p>
          <button
            type="button"
            onClick={onOpenAuth}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800"
          >
            {t.auth.googleSignIn}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.staff.title}</h1>
          <p className="text-xs text-slate-500">
            Authorized venue operator: {user.email}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {managedLocations.length > 0 && (
            <select
              value={activeStaffLocation?.id || ''}
              onChange={(e) => onSelectStaffLocation(e.target.value)}
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-800"
            >
              {managedLocations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          )}

          {activeStaffLocation && (
            <button
              type="button"
              onClick={() => setShowQrScanner(true)}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5"
            >
              <QrCode className="w-4 h-4" />
              <span>{t.staff.scanQrCheckIn}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowRegisterForm((v) => !v)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.staff.registerLocation}</span>
          </button>

          <button
            type="button"
            onClick={onOpenReports}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-slate-800 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <BarChart3 className="w-4 h-4 text-blue-700" />
            <span>{t.staff.viewReports}</span>
          </button>
        </div>
      </div>

      {/* Connect Real Google Place Form */}
      {showRegisterForm && (
        <form
          onSubmit={handleRegisterSubmit}
          className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">{t.staff.registerLocation}</h2>
            {regGooglePlaceId && (
              <span className="text-[11px] font-mono text-emerald-700 font-semibold">
                Linked Google Place ID: {regGooglePlaceId}
              </span>
            )}
          </div>

          {/* Search or quick-pick real Google Place */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            {MAPS_API_KEY && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Search Real Venue via Google Maps
                </label>
                <PlacesAutocompleteBox
                  placeholder="Type a real temple, hospital, bank, mall, cinema..."
                  userCenter={userCenter}
                  onSelectPlace={applyGooglePlaceToForm}
                />
              </div>
            )}
            {nearbyGooglePlaces.length > 0 && (
              <div className="space-y-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Or Pick Detected Nearby Google Place
                </label>
                <select
                  value={regGooglePlaceId || ''}
                  onChange={(e) => {
                    const match = nearbyGooglePlaces.find(
                      (gp) => gp.googlePlaceId === e.target.value
                    );
                    if (match) applyGooglePlaceToForm(match);
                  }}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl border border-slate-200 bg-white text-sm"
                >
                  <option value="">Select a detected nearby place...</option>
                  {nearbyGooglePlaces.map((gp) => (
                    <option key={gp.googlePlaceId} value={gp.googlePlaceId}>
                      {gp.name} ({t.categories[gp.category]})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <input
              type="text"
              required
              value={regName}
              onChange={(e) => setRegName(e.target.value)}
              placeholder="Genuine Venue Name"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="text"
              value={regOrg}
              onChange={(e) => setRegOrg(e.target.value)}
              placeholder="Organization Group"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <select
              value={regCat}
              onChange={(e) => setRegCat(e.target.value as ServiceCategory)}
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
            >
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t.categories[c]}
                </option>
              ))}
            </select>
            <input
              type="text"
              required
              value={regAddress}
              onChange={(e) => setRegAddress(e.target.value)}
              placeholder="Exact Street Address"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm sm:col-span-2"
            />
            <input
              type="text"
              value={regHours}
              onChange={(e) => setRegHours(e.target.value)}
              placeholder="Operating Hours"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="text"
              value={regServices}
              onChange={(e) => setRegServices(e.target.value)}
              placeholder="Services (comma-separated)"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <input
              type="text"
              value={regCounters}
              onChange={(e) => setRegCounters(e.target.value)}
              placeholder="Counters (comma-separated)"
              className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={regAvgMins}
                onChange={(e) => setRegAvgMins(Number(e.target.value))}
                placeholder="Min/person"
                title="Average minutes per visitor"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
              <input
                type="number"
                min={5}
                max={5000}
                value={regMaxCap}
                onChange={(e) => setRegMaxCap(Number(e.target.value))}
                placeholder="Max capacity"
                title="Maximum queue capacity"
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
              />
            </div>
          </div>

          <p className="text-xs text-slate-500 font-mono tabular-nums flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-blue-700" />
            Coordinates: {regLat.toFixed(5)}, {regLng.toFixed(5)}
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busyAction === 'staff_register'}
              className="px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
            >
              Connect Live Queue Feed
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRegisterForm(false);
                onClearPrefillPlace();
              }}
              className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {!activeStaffLocation ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-3">
          <p className="text-sm font-medium text-slate-700">{t.staff.noManagedLocations}</p>
          <button
            type="button"
            onClick={() => setShowRegisterForm(true)}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800"
          >
            {t.staff.createFirstLocation}
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Column: Controls & Live Crowd Status */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="text-base font-bold text-slate-900">{activeStaffLocation.name}</h2>
                  <p className="text-xs text-slate-500 mt-0.5">{activeStaffLocation.address}</p>
                </div>
                <CrowdIndicator
                  level={activeStaffLocation.crowdLevel}
                  label={
                    activeStaffLocation.crowdLevel
                      ? t.crowd[activeStaffLocation.crowdLevel]
                      : t.crowd.unavailable
                  }
                  percentage={activeStaffLocation.crowdPercentage}
                />
              </div>

              <div className="grid grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <p className="text-[11px] text-slate-500">Serving</p>
                  <p className="text-base font-bold font-mono tabular-nums text-blue-700">
                    {activeStaffLocation.currentlyServingCode ?? 'T-000'}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <p className="text-[11px] text-slate-500">{t.staff.waitingCount}</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {waitingTokens.length || activeStaffLocation.waitingCount || 0}
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <p className="text-[11px] text-slate-500">Crowd %</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    {activeStaffLocation.crowdPercentage ?? 0}%
                  </p>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-50">
                  <p className="text-[11px] text-slate-500">Delay</p>
                  <p className="text-base font-bold font-mono tabular-nums text-slate-900">
                    +{activeStaffLocation.delayMinutes}m
                  </p>
                </div>
              </div>

              {/* Verified Crowd Percentage Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">{t.staff.crowdPercentageLabel}</span>
                  <span className="font-mono font-bold text-slate-900 tabular-nums">
                    {activeStaffLocation.crowdPercentage ?? 0}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={activeStaffLocation.crowdPercentage ?? 0}
                  onChange={(e) => {
                    const pct = Number(e.target.value);
                    onUpdateState(activeStaffLocation, {
                      crowdPercentage: pct,
                      crowdLevel: computeCrowdLevel(activeStaffLocation.waitingCount ?? 0, pct),
                    });
                  }}
                  className="w-full accent-blue-700 cursor-pointer"
                />
              </div>

              {/* Crowd Status Control */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">{t.staff.crowdStatus}</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {(['low', 'moderate', 'high', 'very_high'] as CrowdLevel[]).map((lvl) => {
                    const suggestedPct =
                      lvl === 'low' ? 20 : lvl === 'moderate' ? 50 : lvl === 'high' ? 75 : 95;
                    return (
                      <button
                        key={lvl}
                        type="button"
                        onClick={() =>
                          onUpdateState(activeStaffLocation, {
                            crowdLevel: lvl,
                            crowdPercentage: suggestedPct,
                          })
                        }
                        className={`min-h-[40px] px-2 py-1.5 rounded-xl border text-xs font-semibold transition-colors ${
                          activeStaffLocation.crowdLevel === lvl
                            ? 'border-blue-700 bg-blue-50 text-blue-950'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {t.crowd[lvl]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Delay Adjustment */}
              <div className="space-y-1.5">
                <p className="text-xs font-semibold text-slate-700">{t.staff.addDelay}</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {[0, 5, 10, 20].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => onUpdateState(activeStaffLocation, { delayMinutes: mins })}
                      className={`min-h-[40px] px-2 py-1.5 rounded-xl border text-xs font-mono font-semibold ${
                        activeStaffLocation.delayMinutes === mins
                          ? 'border-blue-700 bg-blue-50 text-blue-950'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      +{mins}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Pause / Resume */}
              <button
                type="button"
                onClick={() =>
                  onUpdateState(activeStaffLocation, { isPaused: !activeStaffLocation.isPaused })
                }
                className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border text-xs font-semibold inline-flex items-center justify-center gap-2 ${
                  activeStaffLocation.isPaused
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    : 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                }`}
              >
                {activeStaffLocation.isPaused ? (
                  <>
                    <PlayCircle className="w-4 h-4" />
                    <span>{t.staff.resumeQueue}</span>
                  </>
                ) : (
                  <>
                    <PauseCircle className="w-4 h-4" />
                    <span>{t.staff.pauseQueue}</span>
                  </>
                )}
              </button>
            </div>

            {/* Counters Management */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
              <p className="text-xs font-bold text-slate-900">{t.staff.countersTitle}</p>
              <div className="flex flex-wrap gap-1.5">
                {activeStaffLocation.counters.map((c) => {
                  const active = (selectedCounter || activeStaffLocation.counters[0]) === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedCounter(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCounterInput}
                  onChange={(e) => setNewCounterInput(e.target.value)}
                  placeholder="New counter name"
                  className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!newCounterInput.trim()) return;
                    const updated = [...activeStaffLocation.counters, newCounterInput.trim()].slice(0, 15);
                    onUpdateState(activeStaffLocation, { counters: updated });
                    setNewCounterInput('');
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200"
                >
                  {t.staff.addCounter}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Active Token Calling, QR Check-In & Queue */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold text-slate-700">
                    {t.staff.inProgressTitle} ({inProgressTokens.length})
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Active counter: <span className="font-semibold text-slate-800">{activeCounter}</span>
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setShowQrScanner(true)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>{t.staff.scanQrCheckIn}</span>
                  </button>
                  <button
                    type="button"
                    disabled={busyAction === 'staff_call' || waitingTokens.length === 0}
                    onClick={() => onCallNext(activeStaffLocation, activeCounter)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 inline-flex items-center gap-1.5"
                  >
                    <Megaphone className="w-4 h-4" />
                    <span>{t.staff.callNext}</span>
                  </button>
                </div>
              </div>

              {inProgressTokens.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs text-slate-500">
                  No active or checked-in visitors at counters right now. Scan a visitor QR code or call the next token.
                </div>
              ) : (
                <div className="divide-y divide-slate-100 border border-slate-100 rounded-xl overflow-hidden">
                  {inProgressTokens.map((tok) => (
                    <div
                      key={tok.id}
                      className="p-3.5 bg-emerald-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xl font-bold font-mono tabular-nums text-emerald-700">
                            {tok.tokenCode}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                              tok.status === 'in_progress'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-blue-100 text-blue-800'
                            }`}
                          >
                            {t.status[tok.status]}
                          </span>
                          {tok.counterName && (
                            <span className="text-[11px] font-medium text-slate-600">
                              · {tok.counterName}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-medium text-slate-700">
                          {tok.holderLabel} · {tok.serviceName}
                        </p>
                      </div>

                      <button
                        type="button"
                        disabled={busyAction === 'staff_complete'}
                        onClick={() => onCompleteToken(activeStaffLocation, tok)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 inline-flex items-center gap-1.5 shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{t.staff.completeCurrent}</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-700" />
                  <span>{t.staff.activeTokens}</span>
                </h2>
                <span className="text-xs font-mono tabular-nums text-slate-500">
                  {waitingTokens.length} waiting
                </span>
              </div>

              {waitingTokens.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Queue is clear. Waiting tokens booked by visitors will appear here in real time.
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {waitingTokens.map((tok, index) => (
                    <div key={tok.id} className="p-4 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-mono text-slate-400 w-5 tabular-nums">
                            #{index + 1}
                          </span>
                          <span className="text-base font-bold font-mono tabular-nums text-slate-900">
                            {tok.tokenCode}
                          </span>
                          <div>
                            <p className="text-sm font-semibold text-slate-900">
                              {tok.holderLabel}
                            </p>
                            <p className="text-xs text-slate-500">
                              {tok.serviceName} · {t.priority[tok.priorityTier].label}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSkippingTokenId(skippingTokenId === tok.id ? null : tok.id);
                              setSkipReason('');
                            }}
                            className="min-h-[36px] px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                            <span>{t.staff.skipWithReason}</span>
                          </button>
                        </div>
                      </div>

                      {skippingTokenId === tok.id && (
                        <div className="flex gap-2 pt-1 pl-8">
                          <input
                            type="text"
                            value={skipReason}
                            onChange={(e) => setSkipReason(e.target.value)}
                            placeholder={t.staff.skipReasonPlaceholder}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              await onSkipToken(
                                activeStaffLocation,
                                tok,
                                skipReason || 'Visitor not present'
                              );
                              setSkippingTokenId(null);
                            }}
                            className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                          >
                            Confirm Skip
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showQrScanner && activeStaffLocation && (
        <QrCheckInScannerModal
          locationName={activeStaffLocation.name}
          counterName={activeCounter}
          t={t}
          onCheckIn={(raw) => onCheckInQr(activeStaffLocation, raw, activeCounter)}
          onClose={() => setShowQrScanner(false)}
        />
      )}
    </div>
  );
}

interface ReportsScreenProps {
  locations: ServiceLocation[];
  staffTokens: QueueToken[];
  activeStaffLocation: ServiceLocation | null;
  t: TranslationBundle;
  onBackToStaff: () => void;
}

export function ReportsScreen({
  locations,
  staffTokens,
  activeStaffLocation,
  t,
  onBackToStaff,
}: ReportsScreenProps) {
  const liveVenues = useMemo(() => locations.filter((l) => l.hasLiveCrowdData), [locations]);

  const stats = useMemo(() => {
    const total = staffTokens.length;
    const completed = staffTokens.filter((tk) => tk.status === 'completed').length;
    const skipped = staffTokens.filter((tk) => tk.status === 'skipped').length;
    const cancelled = staffTokens.filter((tk) => tk.status === 'cancelled').length;
    const avgWait =
      total > 0
        ? Math.round(staffTokens.reduce((acc, tk) => acc + tk.estimatedWaitMinutes, 0) / total)
        : 0;

    const priorityCounts = {
      standard: staffTokens.filter((tk) => tk.priorityTier === 'standard').length,
      senior: staffTokens.filter((tk) => tk.priorityTier === 'senior').length,
      disability: staffTokens.filter((tk) => tk.priorityTier === 'disability').length,
      medical: staffTokens.filter((tk) => tk.priorityTier === 'medical').length,
    };

    const hourBuckets: Record<number, number> = {};
    for (let h = 8; h <= 20; h++) hourBuckets[h] = 0;
    staffTokens.forEach((tk) => {
      const hr = new Date(tk.createdAtMs).getHours();
      if (hourBuckets[hr] !== undefined) hourBuckets[hr] += 1;
    });

    return { total, completed, skipped, cancelled, avgWait, priorityCounts, hourBuckets };
  }, [staffTokens]);

  const maxBucket = Math.max(1, ...Object.values(stats.hourBuckets));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{t.reports.title}</h1>
          <p className="text-xs text-slate-500">
            {activeStaffLocation ? activeStaffLocation.name : 'Connected Live Venues'}
          </p>
        </div>
        <button
          type="button"
          onClick={onBackToStaff}
          className="min-h-[40px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50 w-fit"
        >
          Back to Staff Console
        </button>
      </div>

      {/* KPI Row (Strictly real Firestore counts) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">{t.reports.totalIssued}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
            {stats.total}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">{t.reports.completed}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {stats.completed}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">{t.reports.skipped}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {stats.skipped}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-500">{t.reports.cancelled}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">
            {stats.cancelled}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 col-span-2 sm:col-span-1">
          <p className="text-xs text-slate-500">{t.reports.avgWait}</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-blue-700 mt-1">
            {stats.avgWait}m
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">{t.reports.hourlyVolume}</h2>
          <div className="flex items-end justify-between gap-1.5 h-44 pt-4">
            {Object.entries(stats.hourBuckets).map(([hr, count]) => {
              const pct = Math.max(4, Math.round((count / maxBucket) * 100));
              return (
                <div key={hr} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                  <span className="text-[10px] font-mono tabular-nums text-slate-500">
                    {count > 0 ? count : ''}
                  </span>
                  <div
                    className="w-full max-w-[26px] rounded-t-md bg-blue-700/85 transition-all"
                    style={{ height: `${pct}%` }}
                  />
                  <span className="text-[10px] font-mono tabular-nums text-slate-400">
                    {hr}h
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">{t.reports.priorityBreakdown}</h2>
          <div className="space-y-3">
            {(['standard', 'senior', 'disability', 'medical'] as const).map((tier) => {
              const count = stats.priorityCounts[tier];
              const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{t.priority[tier].label}</span>
                    <span className="font-mono tabular-nums text-slate-900 font-semibold">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full bg-blue-700 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Connected Live Venues Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{t.reports.categorySummary}</h2>
        </div>
        {liveVenues.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No authorized venues are connected to live queue feeds yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[11px] font-semibold text-slate-500">
                  <th className="py-2.5 px-4">Location</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4">Crowd</th>
                  <th className="py-2.5 px-4 text-right">Waiting</th>
                  <th className="py-2.5 px-4 text-right">Serving</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {liveVenues.map((loc) => (
                  <tr key={loc.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{loc.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{t.categories[loc.category]}</td>
                    <td className="py-2.5 px-4">
                      <CrowdIndicator
                        level={loc.crowdLevel}
                        label={loc.crowdLevel ? t.crowd[loc.crowdLevel] : t.crowd.unavailable}
                        percentage={loc.crowdPercentage}
                      />
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                      {loc.waitingCount ?? 0}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-700 font-semibold">
                      {loc.currentlyServingCode ?? 'T-000'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
