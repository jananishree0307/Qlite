import React, { useState } from 'react';
import {
  Bell,
  BellRing,
  Bookmark,
  CheckCheck,
  Clock,
  Globe,
  LogOut,
  Shield,
  Sliders,
  Ticket,
} from 'lucide-react';
import { User } from 'firebase/auth';
import { LANGUAGES, TranslationBundle } from '../i18n/translations';
import { formatRelativeTime } from '../lib/queueEngine';
import {
  LanguageCode,
  NotificationPrefs,
  QueueToken,
  ServiceLocation,
  UserNotification,
  UserProfile,
} from '../types/qlite';

interface NotificationsScreenProps {
  notifications: UserNotification[];
  t: TranslationBundle;
  onMarkAllRead: () => Promise<void>;
}

export function NotificationsScreen({
  notifications,
  t,
  onMarkAllRead,
}: NotificationsScreenProps) {
  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
            <BellRing className="w-4 h-4" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">{t.notifications.title}</h1>
        </div>
        {notifications.some((n) => !n.read) && (
          <button
            type="button"
            onClick={onMarkAllRead}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <CheckCheck className="w-4 h-4 text-blue-700" />
            <span>{t.notifications.markAllRead}</span>
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
          <Bell className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600">{t.notifications.empty}</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 overflow-hidden shadow-xs">
          {notifications.map((n) => {
            const isUrgent =
              n.type === 'your_turn' || n.type === 'approaching' || n.type === 'two_ahead';
            return (
              <div
                key={n.id}
                className={`p-4 flex items-start justify-between gap-4 ${
                  n.read
                    ? 'bg-white'
                    : isUrgent
                    ? 'bg-amber-50/50'
                    : 'bg-blue-50/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {!n.read && <span className="w-2 h-2 rounded-full bg-blue-700 shrink-0" />}
                    <p className="text-sm font-bold text-slate-900">{n.title}</p>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{n.message}</p>
                </div>
                <span className="text-[11px] text-slate-400 whitespace-nowrap shrink-0 tabular-nums">
                  {formatRelativeTime(n.createdAtMs)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface BookingHistoryScreenProps {
  tokens: QueueToken[];
  locations: ServiceLocation[];
  t: TranslationBundle;
  onOpenToken: (token: QueueToken) => void;
  onBookAgain: (location: ServiceLocation) => void;
}

export function BookingHistoryScreen({
  tokens,
  locations,
  t,
  onOpenToken,
  onBookAgain,
}: BookingHistoryScreenProps) {
  const [tab, setTab] = useState<'active' | 'past'>('active');

  const activeTokens = tokens.filter(
    (tk) => tk.status === 'waiting' || tk.status === 'in_progress' || tk.status === 'serving'
  );
  const pastTokens = tokens.filter(
    (tk) => tk.status !== 'waiting' && tk.status !== 'in_progress' && tk.status !== 'serving'
  );
  const displayed = tab === 'active' ? activeTokens : pastTokens;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-900">{t.history.title}</h1>
        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-xl w-fit">
          <button
            type="button"
            onClick={() => setTab('active')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'active'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.history.activeTab} ({activeTokens.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('past')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
              tab === 'past'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {t.history.pastTab} ({pastTokens.length})
          </button>
        </div>
      </div>

      {displayed.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-2">
          <Ticket className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm text-slate-600">
            {tab === 'active' ? t.history.emptyActive : t.history.emptyPast}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {displayed.map((tk) => {
            const loc = locations.find((l) => l.id === tk.locationId);
            const dateStr = new Date(tk.createdAtMs).toLocaleString([], {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            });
            return (
              <div
                key={tk.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500">
                    <span className="font-mono font-bold text-sm text-blue-700 tabular-nums">
                      {tk.tokenCode}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-semibold text-slate-800">{t.status[tk.status]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="inline-flex items-center gap-1 tabular-nums">
                      <Clock className="w-3.5 h-3.5" />
                      {dateStr}
                    </span>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">{tk.locationName}</h3>
                  <p className="text-xs text-slate-600">
                    {tk.serviceName} · {t.priority[tk.priorityTier].label}
                  </p>
                  {tk.skipReason && (
                    <p className="text-xs text-red-600">
                      {t.history.skipReasonLabel}: {tk.skipReason}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {tab === 'active' ? (
                    <button
                      type="button"
                      onClick={() => onOpenToken(tk)}
                      className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
                    >
                      {t.token.trackLive}
                    </button>
                  ) : (
                    loc && (
                      <button
                        type="button"
                        onClick={() => onBookAgain(loc)}
                        className="min-h-[40px] px-4 py-2 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        {t.history.bookAgain}
                      </button>
                    )
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface ProfileSettingsScreenProps {
  user: User | null;
  profile: UserProfile | null;
  language: LanguageCode;
  locations: ServiceLocation[];
  t: TranslationBundle;
  onChangeLanguage: (lang: LanguageCode) => void;
  onUpdateProfile: (updates: {
    displayName?: string;
    phoneNumber?: string;
    notificationPrefs?: NotificationPrefs;
  }) => Promise<void>;
  onSelectFavorite: (loc: ServiceLocation) => void;
  onOpenAuth: () => void;
  onOpenStaffDashboard: () => void;
  onSignOut: () => Promise<void>;
}

export function ProfileSettingsScreen({
  user,
  profile,
  language,
  locations,
  t,
  onChangeLanguage,
  onUpdateProfile,
  onSelectFavorite,
  onOpenAuth,
  onOpenStaffDashboard,
  onSignOut,
}: ProfileSettingsScreenProps) {
  const [name, setName] = useState(profile?.displayName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phoneNumber || '');
  const [prefs, setPrefs] = useState<NotificationPrefs>(
    profile?.notificationPrefs || {
      fiveAhead: true,
      turnReady: true,
      delays: true,
      browserPush: false,
    }
  );
  const [savedMsg, setSavedMsg] = useState(false);

  const favoriteLocs = locations.filter((l) => profile?.favoriteLocationIds.includes(l.id));
  const browserPerm =
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default';

  const handleToggleBrowserPush = async (checked: boolean) => {
    if (checked && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch {
        // Ignore if unsupported
      }
    }
    setPrefs((prev) => ({ ...prev, browserPush: checked }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await onUpdateProfile({
      displayName: name || profile?.displayName || 'QLite User',
      phoneNumber: phone,
      notificationPrefs: prefs,
    });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">{t.profile.title}</h1>
        <button
          type="button"
          onClick={onOpenStaffDashboard}
          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 inline-flex items-center gap-1.5 transition-colors"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>{t.profile.staffPortalBtn}</span>
        </button>
      </div>

      {/* Account Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <h2 className="text-sm font-bold text-slate-900">{t.profile.accountSection}</h2>
        {!user ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-4">
            <p className="text-xs text-slate-600">{t.auth.guestModeNote}</p>
            <button
              type="button"
              onClick={onOpenAuth}
              className="min-h-[40px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 whitespace-nowrap"
            >
              {t.auth.googleSignIn}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t.auth.nameLabel}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={80}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">
                  {t.auth.mobileLabel}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  maxLength={20}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-mono"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-2.5">
              <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-blue-700" />
                <span>{t.profile.notificationsSection}</span>
              </p>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700 py-1 cursor-pointer">
                <span>{t.profile.fiveAheadPref}</span>
                <input
                  type="checkbox"
                  checked={prefs.fiveAhead}
                  onChange={(e) => setPrefs((p) => ({ ...p, fiveAhead: e.target.checked }))}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700 py-1 cursor-pointer">
                <span>{t.profile.turnReadyPref}</span>
                <input
                  type="checkbox"
                  checked={prefs.turnReady}
                  onChange={(e) => setPrefs((p) => ({ ...p, turnReady: e.target.checked }))}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700 py-1 cursor-pointer">
                <span>{t.profile.delaysPref}</span>
                <input
                  type="checkbox"
                  checked={prefs.delays}
                  onChange={(e) => setPrefs((p) => ({ ...p, delays: e.target.checked }))}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>
              <label className="flex items-center justify-between gap-3 text-sm text-slate-700 py-1 cursor-pointer">
                <span>{t.profile.browserPushPref}</span>
                <input
                  type="checkbox"
                  checked={prefs.browserPush}
                  onChange={(e) => handleToggleBrowserPush(e.target.checked)}
                  className="w-4 h-4 accent-blue-700"
                />
              </label>
              {prefs.browserPush && (
                <p className="text-[11px] text-slate-500">
                  {browserPerm === 'denied'
                    ? 'Browser notifications are blocked in browser site settings.'
                    : profile?.fcmToken
                    ? 'Web push alerts are active and linked to this device.'
                    : 'Queue alert notifications are ready in this browser.'}
                </p>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="submit"
                className="min-h-[44px] px-4 py-2 rounded-xl bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors"
              >
                {t.profile.saveChanges}
              </button>
              {savedMsg && (
                <span className="text-xs font-semibold text-emerald-700">
                  {t.profile.savedToast}
                </span>
              )}
              <button
                type="button"
                onClick={onSignOut}
                className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 inline-flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.auth.signOut}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Language Selector */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-bold text-slate-900">{t.profile.languageSection}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => onChangeLanguage(lang.code)}
              className={`min-h-[44px] px-3 py-2 rounded-xl border text-left text-xs font-semibold transition-colors ${
                language === lang.code
                  ? 'border-blue-700 bg-blue-50 text-blue-950'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div>{lang.nativeName}</div>
              <div className="text-[11px] font-normal text-slate-500">{lang.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Saved Favorite Locations */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Bookmark className="w-4 h-4 text-blue-700" />
          <h2 className="text-sm font-bold text-slate-900">{t.profile.favoritesSection}</h2>
        </div>
        {favoriteLocs.length === 0 ? (
          <p className="text-xs text-slate-500">{t.profile.noFavorites}</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {favoriteLocs.map((loc) => (
              <button
                key={loc.id}
                type="button"
                onClick={() => onSelectFavorite(loc)}
                className="w-full py-2.5 text-left flex items-center justify-between hover:bg-slate-50 rounded-lg px-2"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{loc.name}</p>
                  <p className="text-xs text-slate-500">{loc.address}</p>
                </div>
                <span className="text-xs font-semibold text-blue-700">Open →</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
