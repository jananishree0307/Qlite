import React, { useState } from 'react';
import { ArrowRight, Check, Globe, Phone, ShieldCheck, Sparkles, User as UserIcon } from 'lucide-react';
import { User } from 'firebase/auth';
import { BRAND_IMAGE_PATH, HERO_CITY_IMAGE_PATH } from '../data/seedLocations';
import { LANGUAGES, TranslationBundle } from '../i18n/translations';
import { LanguageCode, UserProfile } from '../types/qlite';

interface SplashScreenProps {
  t: TranslationBundle;
  onContinue: () => void;
  onChooseLanguage: () => void;
}

export function SplashScreen({ t, onContinue, onChooseLanguage }: SplashScreenProps) {
  return (
    <div className="min-h-screen smart-navy-hero relative overflow-hidden flex flex-col items-center justify-center p-6">
      <img
        src={HERO_CITY_IMAGE_PATH}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-luminosity pointer-events-none"
      />
      <div className="relative z-10 max-w-md w-full bg-white/98 backdrop-blur-md border border-white/40 rounded-3xl p-8 text-center shadow-2xl">
        <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-5 border border-slate-200 shadow-md bg-slate-900">
          <img
            src={BRAND_IMAGE_PATH}
            alt="QLite emblem"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Smart-City Queue Intelligence</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 mb-2">
          {t.appName}
        </h1>
        <p className="text-base text-slate-600 mb-8 text-balance leading-relaxed">
          {t.tagline}
        </p>

        <div className="space-y-3">
          <button
            type="button"
            onClick={onContinue}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 shadow-sm"
          >
            <span>{t.getStarted}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onChooseLanguage}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-sm font-medium hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
          >
            <Globe className="w-4 h-4 text-blue-700" />
            <span>{t.chooseLanguage}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

interface LanguageSelectionScreenProps {
  currentLanguage: LanguageCode;
  t: TranslationBundle;
  onSelectLanguage: (lang: LanguageCode) => void;
  onContinue: () => void;
}

export function LanguageSelectionScreen({
  currentLanguage,
  t,
  onSelectLanguage,
  onContinue,
}: LanguageSelectionScreenProps) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="smart-navy-hero text-white px-6 py-6 sm:px-8 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 backdrop-blur-xs text-white flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold">{t.chooseLanguage}</h1>
            <p className="text-sm text-blue-100">{t.languageSubtitle}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {LANGUAGES.map((lang) => {
              const active = currentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => onSelectLanguage(lang.code)}
                  className={`min-h-[58px] px-4 py-3 rounded-xl border text-left transition-all flex items-center justify-between ${
                    active
                      ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-600/15'
                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <div>
                    <div className="text-sm font-semibold">{lang.nativeName}</div>
                    <div className="text-xs text-slate-500">{lang.name}</div>
                  </div>
                  {active && (
                    <div className="w-6 h-6 rounded-full bg-blue-700 text-white flex items-center justify-center shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onContinue}
            className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
          >
            <span>{t.continueBtn}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

interface AuthScreenProps {
  user: User | null;
  profile: UserProfile | null;
  t: TranslationBundle;
  busy: boolean;
  onGoogleSignIn: () => Promise<void>;
  onSaveProfile: (name: string, phone: string) => Promise<void>;
  onContinue: () => void;
}

export function AuthScreen({
  user,
  profile,
  t,
  busy,
  onGoogleSignIn,
  onSaveProfile,
  onContinue,
}: AuthScreenProps) {
  const [name, setName] = useState(profile?.displayName || user?.displayName || '');
  const [phone, setPhone] = useState(profile?.phoneNumber || '');
  const [otpRequested, setOtpRequested] = useState(false);
  const [otpInput, setOtpInput] = useState('');
  const [error, setError] = useState('');
  const [savedNotice, setSavedNotice] = useState(false);

  const handleVerifyMobile = () => {
    const cleaned = phone.replace(/\s+/g, '');
    if (cleaned.length < 8) {
      setError('Enter a valid mobile number (at least 8 digits).');
      return;
    }
    setError('');
    setOtpRequested(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (otpRequested && otpInput.trim().length > 0 && otpInput.trim() !== '123456') {
      setError('Verification code check: enter 123456 or leave blank after Google Sign-In.');
      return;
    }
    setError('');
    await onSaveProfile(name.trim(), phone.trim());
    setSavedNotice(true);
    setTimeout(() => {
      onContinue();
    }, 350);
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="smart-navy-hero text-white px-6 py-6 sm:px-8 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-white/15 text-white flex items-center justify-center shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">
              {user ? t.auth.completeProfile : t.auth.title}
            </h1>
            <p className="text-sm text-blue-100">{t.auth.subtitle}</p>
          </div>
        </div>

        <div className="p-6 sm:p-8">
          {!user ? (
            <div className="space-y-4">
              <button
                type="button"
                disabled={busy}
                onClick={onGoogleSignIn}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 disabled:opacity-60 transition-colors flex items-center justify-center gap-2 shadow-xs"
              >
                <span>{busy ? 'Signing in...' : t.auth.googleSignIn}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 leading-relaxed">
                {t.auth.otpNote}
              </div>

              <button
                type="button"
                onClick={onContinue}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Browse Locations First
              </button>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5">
                {t.auth.signedInAs}: <span className="font-semibold text-slate-900">{user.email}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.auth.nameLabel}
                </label>
                <div className="relative flex items-center">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.auth.namePlaceholder}
                    maxLength={80}
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {t.auth.mobileLabel}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1 flex items-center">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3.5" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder={t.auth.mobilePlaceholder}
                      maxLength={20}
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyMobile}
                    className="px-3.5 py-2.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold hover:bg-slate-200 whitespace-nowrap shrink-0 min-h-[44px]"
                  >
                    {t.auth.sendOtpDemo}
                  </button>
                </div>
              </div>

              {otpRequested && (
                <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 space-y-2">
                  <p className="text-xs text-blue-900">
                    Format verified. Enter <span className="font-mono font-semibold">123456</span> or leave empty to save directly.
                  </p>
                  <input
                    type="text"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    placeholder="123456"
                    maxLength={6}
                    className="w-full px-3.5 py-2 rounded-lg border border-blue-200 bg-white text-sm font-mono tracking-widest"
                  />
                </div>
              )}

              {error && <p className="text-xs text-red-600 font-medium">{error}</p>}
              {savedNotice && <p className="text-xs text-emerald-700 font-medium">Profile saved!</p>}

              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl bg-blue-700 text-white text-sm font-semibold hover:bg-blue-800 transition-colors"
              >
                {t.auth.verifyAndContinue}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
