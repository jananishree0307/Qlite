import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Clock,
  Download,
  MapPin,
  Navigation,
  Ticket,
  Users,
  XCircle,
} from 'lucide-react';
import { motion } from 'motion/react';
import { TranslationBundle } from '../i18n/translations';
import { computeTokenPosition, estimateTravelMinutes, haversineDistanceKm } from '../lib/queueEngine';
import { LatLngLiteral, QueueToken, ServiceLocation, buildTokenQrPayload } from '../types/qlite';
import { CrowdIndicator, getCrowdBarColor } from '../components/CrowdBadge';

function ScannableTokenQr({ token }: { token: QueueToken }) {
  const [dataUrl, setDataUrl] = useState<string>('');
  const payload = buildTokenQrPayload(token);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(payload, {
      width: 240,
      margin: 1,
      color: {
        dark: '#071329',
        light: '#FFFFFF',
      },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setDataUrl('');
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  return (
    <div className="flex flex-col items-center gap-1.5 shrink-0">
      <div className="w-24 h-24 rounded-2xl border border-white/25 bg-white p-1.5 flex items-center justify-center shadow-sm">
        {dataUrl ? (
          <img
            src={dataUrl}
            alt={`QR code for token ${token.tokenCode}`}
            className="w-full h-full object-contain"
          />
        ) : (
          <span className="text-[10px] font-mono text-slate-400">QR</span>
        )}
      </div>
      {dataUrl && (
        <a
          href={dataUrl}
          download={`qlite-${token.tokenCode}.png`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-100 hover:text-white underline"
        >
          <Download className="w-3 h-3" />
          <span>Save QR</span>
        </a>
      )}
    </div>
  );
}

interface DigitalTokenScreenProps {
  token: QueueToken | null;
  location: ServiceLocation | null;
  activeLocationTokens: QueueToken[];
  userCenter: LatLngLiteral;
  busy: boolean;
  t: TranslationBundle;
  onOpenLiveQueue: () => void;
  onCancelToken: (token: QueueToken) => Promise<void>;
  onExplore: () => void;
}

export function DigitalTokenScreen({
  token,
  location,
  activeLocationTokens,
  userCenter,
  busy,
  t,
  onOpenLiveQueue,
  onCancelToken,
  onExplore,
}: DigitalTokenScreenProps) {
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [err, setErr] = useState('');

  if (!token || !location) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Ticket className="w-10 h-10 text-slate-400 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">{t.token.noActiveToken}</h1>
          <button
            type="button"
            onClick={onExplore}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            {t.token.exploreNow}
          </button>
        </div>
      </div>
    );
  }

  const pos = computeTokenPosition(token, activeLocationTokens, location);
  const distKm = haversineDistanceKm(userCenter, { lat: location.lat, lng: location.lng });
  const travelMins = estimateTravelMinutes(distKm);
  const bookedTime = new Date(token.createdAtMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  const handleCancel = async () => {
    setErr('');
    try {
      await onCancelToken(token);
      setConfirmingCancel(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Unable to cancel token');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 sm:px-6 py-6 space-y-4">
      {/* Digital Boarding-Pass Ticket */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        {/* Top Navy Pass Header */}
        <div className="smart-navy-hero text-white p-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-200">
              {t.token.title}
            </p>
            <h1 className="text-4xl sm:text-5xl font-bold font-mono tabular-nums tracking-tight mt-1">
              {token.tokenCode}
            </h1>
            <p className="text-xs text-blue-100 mt-1.5">
              {t.priority[token.priorityTier].label} ·{' '}
              <span className="font-semibold text-white">{t.status[token.status]}</span>
            </p>
          </div>
          <ScannableTokenQr token={token} />
        </div>

        {/* Perforated Boarding-Pass Divider */}
        <div className="relative flex items-center bg-white py-2">
          <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -ml-2.5 shrink-0" />
          <div className="flex-1 border-t-2 border-dashed border-slate-200 mx-2" />
          <div className="w-5 h-5 rounded-full bg-slate-50 border border-slate-200 -mr-2.5 shrink-0" />
        </div>

        <div className="px-6 pb-6 pt-2 space-y-5">
          {token.status === 'in_progress' && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2.5 font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {t.token.inProgressBanner} ({token.counterName || location.counters[0] || 'Counter 1'})
              </span>
            </div>
          )}

          <div className="space-y-1">
            <p className="text-xs text-slate-500">{t.token.placeName}</p>
            <p className="text-lg font-bold text-slate-900">{token.locationName}</p>
            <p className="text-xs text-slate-600 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <span className="truncate">{location.address}</span>
            </p>
            <p className="text-xs text-slate-500 pt-0.5">
              {t.token.service}: <span className="font-semibold text-slate-800">{token.serviceName}</span> ·{' '}
              {token.slotLabel}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-slate-100">
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{t.token.bookedAt}</p>
              <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {bookedTime}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{t.token.estServiceTime}</p>
              <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {pos.expectedServiceTimeStr}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{t.token.estWait}</p>
              <p className="text-sm font-bold text-blue-700 font-mono tabular-nums mt-0.5">
                {pos.estimatedWaitMinutes} {t.place.mins}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3">
              <p className="text-[11px] text-slate-500">{t.token.peopleAhead}</p>
              <p className="text-sm font-bold text-slate-900 font-mono tabular-nums mt-0.5">
                {pos.peopleAhead}
              </p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 col-span-1 sm:col-span-2">
              <p className="text-[11px] text-slate-500">{t.token.currentlyServing}</p>
              <p className="text-sm font-bold text-blue-700 font-mono tabular-nums mt-0.5">
                {location.currentlyServingCode ?? 'T-000'}
              </p>
            </div>
          </div>

          {token.status === 'waiting' && (
            <p className="text-xs text-slate-600 bg-slate-50 border border-slate-200/80 rounded-xl px-3.5 py-2.5">
              {t.token.showQrAtCounter}
            </p>
          )}

          {travelMins > pos.estimatedWaitMinutes && token.status === 'waiting' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                Travel time (~{travelMins} min) is close to or greater than your remaining wait (~{pos.estimatedWaitMinutes} min). Head toward the venue now.
              </span>
            </div>
          )}

          <p className="text-[11px] text-slate-400 font-mono truncate">Token ID: {token.id}</p>

          {err && <p className="text-xs text-red-600 font-medium">{err}</p>}

          <div className="flex flex-col sm:flex-row gap-3 pt-1">
            <button
              type="button"
              onClick={onOpenLiveQueue}
              className="flex-1 min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors inline-flex items-center justify-center gap-2"
            >
              <span>{t.token.trackLive}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {token.status === 'waiting' && !confirmingCancel && (
              <button
                type="button"
                onClick={() => setConfirmingCancel(true)}
                className="min-h-[48px] px-4 py-3 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold hover:bg-red-100 transition-colors"
              >
                {t.token.cancelToken}
              </button>
            )}
          </div>

          {confirmingCancel && token.status === 'waiting' && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <span className="text-xs font-medium text-red-900">
                Cancel token {token.tokenCode}? Your queue spot will be released.
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCancel}
                  className="px-3.5 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                >
                  {t.token.confirmCancel}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmingCancel(false)}
                  className="px-3.5 py-2 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold"
                >
                  Keep
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface LiveQueueScreenProps {
  token: QueueToken | null;
  location: ServiceLocation | null;
  activeLocationTokens: QueueToken[];
  userCenter: LatLngLiteral;
  busy: boolean;
  t: TranslationBundle;
  onCancelToken: (token: QueueToken) => Promise<void>;
  onExplore: () => void;
}

export function LiveQueueScreen({
  token,
  location,
  activeLocationTokens,
  userCenter,
  busy,
  t,
  onCancelToken,
  onExplore,
}: LiveQueueScreenProps) {
  if (!token || !location) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <Activity className="w-10 h-10 text-slate-400 mx-auto" />
          <h1 className="text-lg font-bold text-slate-900">{t.token.noActiveToken}</h1>
          <button
            type="button"
            onClick={onExplore}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
          >
            {t.token.exploreNow}
          </button>
        </div>
      </div>
    );
  }

  const pos = computeTokenPosition(token, activeLocationTokens, location);
  const distKm = haversineDistanceKm(userCenter, { lat: location.lat, lng: location.lng });
  const travelMins = estimateTravelMinutes(distKm);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      {/* Real-time Milestone Alert Banners (5 ahead, 2 ahead, 1 ahead, Your Turn) */}
      {token.status === 'in_progress' && (
        <div className="bg-emerald-700 text-white rounded-2xl p-5 flex items-center gap-3.5 shadow-sm">
          <CheckCircle2 className="w-7 h-7 shrink-0" />
          <div>
            <p className="text-base font-bold">{t.token.inProgressBanner}</p>
            <p className="text-xs text-emerald-100 mt-0.5">
              Counter: {token.counterName || location.counters[0] || 'Counter 1'} · {location.name}
            </p>
          </div>
        </div>
      )}

      {token.status === 'serving' && (
        <div className="bg-emerald-700 text-white rounded-2xl p-5 flex items-center gap-3.5 shadow-sm">
          <CheckCircle2 className="w-7 h-7 shrink-0" />
          <div>
            <p className="text-base font-bold">{t.token.yourTurnBanner}</p>
            <p className="text-xs text-emerald-100 mt-0.5">
              Counter: {token.counterName || location.counters[0] || 'Counter 1'} · {location.name}
            </p>
          </div>
        </div>
      )}

      {token.status === 'waiting' && pos.peopleAhead <= 1 && (
        <div className="bg-orange-50 border border-orange-300 text-orange-950 rounded-2xl p-4 flex items-center gap-3">
          <BellRing className="w-5 h-5 text-orange-600 shrink-0" />
          <p className="text-sm font-semibold">{t.token.approachingBanner}</p>
        </div>
      )}

      {token.status === 'waiting' && pos.peopleAhead === 2 && (
        <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-2xl p-4 flex items-center gap-3">
          <BellRing className="w-5 h-5 text-amber-700 shrink-0" />
          <p className="text-sm font-semibold">{t.token.twoAheadBanner}</p>
        </div>
      )}

      {token.status === 'waiting' && pos.peopleAhead > 2 && pos.peopleAhead <= 5 && (
        <div className="bg-blue-50 border border-blue-200 text-blue-950 rounded-2xl p-4 flex items-center gap-3">
          <BellRing className="w-5 h-5 text-blue-700 shrink-0" />
          <p className="text-sm font-semibold">{t.token.fiveAheadBanner}</p>
        </div>
      )}

      {/* Primary Live Queue Status Card */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="smart-navy-hero text-white px-5 sm:px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-xs text-blue-200">
              {location.hasLiveCrowdData ? t.dataSource.live_provider : t.dataSource.unavailable}
            </p>
            <h1 className="text-xl font-bold text-white mt-0.5">{location.name}</h1>
            <p className="text-xs text-blue-100 mt-0.5">
              {token.serviceName} ·{' '}
              <span className="font-semibold text-white">{t.status[token.status]}</span>
            </p>
          </div>
          <CrowdIndicator
            level={location.crowdLevel}
            label={location.crowdLevel ? t.crowd[location.crowdLevel] : t.crowd.unavailable}
            percentage={location.crowdPercentage}
          />
        </div>

        <div className="p-5 sm:p-6 space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
              <p className="text-xs text-blue-800">{t.token.tokenNumber}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-blue-950 mt-1">
                {token.tokenCode}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">{t.token.currentlyServing}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                {location.currentlyServingCode ?? 'T-000'}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">{t.token.peopleAhead}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-blue-700" />
                {pos.peopleAhead}
              </p>
            </div>
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <p className="text-xs text-slate-500">{t.token.estWait}</p>
              <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-700" />
                {pos.estimatedWaitMinutes}m
              </p>
            </div>
          </div>

          {/* Animated Queue Progress Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700">{t.token.progress}</span>
              <span className="font-mono tabular-nums text-slate-600">
                {t.token.estServiceTime}: {pos.expectedServiceTimeStr} ({pos.progressPercent}%)
              </span>
            </div>
            <div className="w-full h-3.5 rounded-full bg-slate-100 overflow-hidden p-0.5">
              <motion.div
                className={`h-full rounded-full ${
                  token.status === 'in_progress' || token.status === 'serving'
                    ? 'bg-emerald-600'
                    : getCrowdBarColor(location.crowdLevel) || 'bg-blue-700'
                }`}
                initial={{ width: 0 }}
                animate={{ width: `${pos.progressPercent}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            </div>
          </div>

          {/* Delay / Travel Advisory */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-2">
              <Navigation className="w-4 h-4 text-blue-700 shrink-0" />
              <span>
                Travel estimate: <strong className="font-mono">{travelMins} min</strong> ({distKm.toFixed(1)} km)
                {location.delayMinutes > 0 && ` · Provider delay +${location.delayMinutes} min`}
              </span>
            </div>
            {token.status === 'waiting' && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onCancelToken(token)}
                className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 font-semibold min-h-[40px]"
              >
                <XCircle className="w-4 h-4" />
                <span>{t.token.cancelToken}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Live Queue Lineup Preview */}
      {activeLocationTokens.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Active Queue Lineup</h2>
          <div className="divide-y divide-slate-100">
            {activeLocationTokens.slice(0, 8).map((item) => {
              const isMe = item.id === token.id;
              return (
                <div
                  key={item.id}
                  className={`py-2.5 flex items-center justify-between text-xs ${
                    isMe ? 'font-bold text-blue-800' : 'text-slate-700'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono tabular-nums text-sm">{item.tokenCode}</span>
                    <span>{item.serviceName}</span>
                    {item.priorityTier !== 'standard' && (
                      <span className="text-[11px] text-amber-700 font-semibold">
                        · {t.priority[item.priorityTier].label}
                      </span>
                    )}
                  </div>
                  <span>{isMe ? 'You' : t.status[item.status]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
