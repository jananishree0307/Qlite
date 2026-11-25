import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { APIProvider } from '@vis.gl/react-google-maps';
import {
  Activity,
  Bell,
  Compass,
  History,
  Home,
} from 'lucide-react';
import { DEFAULT_GPS_CENTER } from './data/seedLocations';
import { useNearbyGooglePlaces } from './hooks/useNearbyGooglePlaces';
import { useQLiteData } from './hooks/useQLiteData';
import { getTranslations } from './i18n/translations';
import { registerQueueNotificationWorker, subscribeForegroundFcm } from './lib/fcm';
import { googlePlaceToUnavailableLocation, haversineDistanceKm } from './lib/queueEngine';
import {
  AppScreen,
  DiscoveredGooglePlace,
  LanguageCode,
  LatLngLiteral,
  PriorityTier,
  QueueToken,
  RecentlyViewedLocation,
  RouteEstimate,
  ServiceCategory,
  ServiceLocation,
} from './types/qlite';
import {
  AuthScreen,
  LanguageSelectionScreen,
  SplashScreen,
} from './screens/OnboardingScreens';
import { GpsPermissionStatus, HomeScreen } from './screens/HomeScreen';
import { ExploreScreen } from './screens/ExploreScreen';
import {
  BookingScreen,
  PlaceDetailsScreen,
} from './screens/PlaceAndBookingScreens';
import {
  DigitalTokenScreen,
  LiveQueueScreen,
} from './screens/TokenAndLiveScreens';
import {
  BookingHistoryScreen,
  NotificationsScreen,
  ProfileSettingsScreen,
} from './screens/UserUtilityScreens';
import {
  ReportsScreen,
  StaffDashboardScreen,
} from './screens/StaffAndReportsScreens';
import { MAPS_API_KEY } from './components/MapsExplorer';

interface AppContentProps {
  language: LanguageCode;
  onChangeLanguageState: (lang: LanguageCode) => void;
}

function AppContent({ language, onChangeLanguageState }: AppContentProps) {
  const data = useQLiteData();

  const [screen, setScreen] = useState<AppScreen>(() => {
    const onboarded = localStorage.getItem('qlite_onboarded');
    return onboarded === '1' ? 'home' : 'splash';
  });
  const [postAuthScreen, setPostAuthScreen] = useState<AppScreen>('home');

  const [userCenter, setUserCenter] = useState<LatLngLiteral>(DEFAULT_GPS_CENTER);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsPermission, setGpsPermission] = useState<GpsPermissionStatus>('detecting');
  const [areaLabel, setAreaLabel] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ServiceCategory | 'all'>('all');
  const [radiusKm, setRadiusKm] = useState<number>(10);
  const [mapsQuotaExceeded, setMapsQuotaExceeded] = useState(false);
  const [exploreWithRoute, setExploreWithRoute] = useState(false);
  const [routeEstimate, setRouteEstimate] = useState<RouteEstimate | null>(null);
  const [viewedToken, setViewedToken] = useState<QueueToken | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [inspectedPlaces, setInspectedPlaces] = useState<Record<string, DiscoveredGooglePlace>>({});
  const [staffPrefillPlace, setStaffPrefillPlace] = useState<DiscoveredGooglePlace | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<RecentlyViewedLocation[]>(() => {
    try {
      const raw = localStorage.getItem('qlite_recently_viewed');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
    } catch {
      return [];
    }
  });

  const lastCenterRef = useRef<LatLngLiteral>(DEFAULT_GPS_CENTER);
  const manualAreaOverrideRef = useRef(false);
  const gpsActiveRef = useRef(false);

  // Automatic real-world nearby place detection via Google Places API (New)
  const nearby = useNearbyGooglePlaces(
    userCenter,
    categoryFilter,
    language,
    Boolean(MAPS_API_KEY),
    radiusKm
  );

  // Sync language from Firestore profile when loaded
  useEffect(() => {
    if (data.profile?.language) {
      onChangeLanguageState(data.profile.language);
      localStorage.setItem('qlite_lang', data.profile.language);
    }
  }, [data.profile?.language, onChangeLanguageState]);

  // Listen for Google Maps Demo Key quota errors
  useEffect(() => {
    const onQuota = () => setMapsQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', onQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', onQuota);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3200);
  }, []);

  // Register push worker & foreground FCM message listener
  useEffect(() => {
    let unsubFcm = () => {};
    void registerQueueNotificationWorker();
    void subscribeForegroundFcm((title, body) => {
      showToast(`${title}: ${body}`);
    }).then((unsub) => {
      unsubFcm = unsub;
    });
    return () => {
      unsubFcm();
    };
  }, [showToast]);

  const applyNewCoordinates = useCallback(
    (next: LatLngLiteral, fromGps: boolean, customLabel: string | null = null) => {
      const movedKm = haversineDistanceKm(lastCenterRef.current, next);
      if (!fromGps || !gpsActiveRef.current || movedKm >= 0.25) {
        if (movedKm >= 1.0) {
          setInspectedPlaces({});
          data.setSelectedLocationId(null);
        }
        lastCenterRef.current = next;
        setUserCenter(next);
      }
      if (fromGps) {
        gpsActiveRef.current = true;
        setGpsActive(true);
        setGpsPermission('granted');
        setAreaLabel(null);
      } else {
        setAreaLabel(customLabel);
      }
    },
    [data.setSelectedLocationId]
  );

  // Automatically detect GPS on mount & continuously watch for movement to new areas/cities
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermission('unsupported');
      return;
    }

    let watchId: number | null = null;
    let permStatus: PermissionStatus | null = null;

    const startWatching = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      watchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (manualAreaOverrideRef.current) {
            setGpsPermission('granted');
            return;
          }
          applyNewCoordinates(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            true
          );
        },
        (err) => {
          if (err.code === err.PERMISSION_DENIED) {
            gpsActiveRef.current = false;
            setGpsPermission('denied');
            setGpsActive(false);
          }
        },
        { enableHighAccuracy: false, maximumAge: 30000, timeout: 8000 }
      );
    };

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (!manualAreaOverrideRef.current) {
          applyNewCoordinates(
            { lat: pos.coords.latitude, lng: pos.coords.longitude },
            true
          );
        }
        startWatching();
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsPermission('denied');
        } else {
          setGpsPermission('denied');
        }
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          permStatus = status;
          if (status.state === 'denied') setGpsPermission('denied');
          status.onchange = () => {
            if (status.state === 'granted') {
              setGpsPermission('detecting');
              manualAreaOverrideRef.current = false;
              startWatching();
            } else if (status.state === 'denied') {
              gpsActiveRef.current = false;
              setGpsPermission('denied');
              setGpsActive(false);
            }
          };
        })
        .catch(() => {
          // Ignore browsers that block permissions API
        });
    }

    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
      if (permStatus) {
        permStatus.onchange = null;
      }
    };
  }, [applyNewCoordinates]);

  const t = useMemo(() => getTranslations(language), [language]);

  const handleLanguageChange = useCallback(
    async (lang: LanguageCode) => {
      onChangeLanguageState(lang);
      localStorage.setItem('qlite_lang', lang);
      if (data.user && data.profile) {
        await data.updateProfileSettings({ language: lang });
      }
    },
    [data, onChangeLanguageState]
  );

  const handleRequestGps = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsPermission('unsupported');
      showToast('GPS is not supported on this device; search an area to preview nearby places.');
      return;
    }
    manualAreaOverrideRef.current = false;
    setGpsPermission('detecting');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setInspectedPlaces({});
        data.setSelectedLocationId(null);
        lastCenterRef.current = next;
        gpsActiveRef.current = true;
        setUserCenter(next);
        setGpsActive(true);
        setGpsPermission('granted');
        setAreaLabel(null);
        nearby.refresh();
        showToast('Live GPS updated. Fetching nearby real-world places...');
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          setGpsPermission('denied');
          showToast('Location permission denied. Enable location in browser settings or select an area.');
        } else {
          showToast('Unable to get GPS fix right now. Try selecting an area.');
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [data.setSelectedLocationId, nearby.refresh, showToast]);

  const handleMoveArea = useCallback(
    (place: DiscoveredGooglePlace) => {
      manualAreaOverrideRef.current = true;
      const next = { lat: place.lat, lng: place.lng };
      setInspectedPlaces({});
      data.setSelectedLocationId(null);
      lastCenterRef.current = next;
      setUserCenter(next);
      setAreaLabel(place.name);
      showToast(`Showing real nearby places around ${place.name}`);
    },
    [data.setSelectedLocationId, showToast]
  );

  // Merge real Google Places + connected Firestore live venues without fabricating any crowd metrics
  const mergedLocations = useMemo<ServiceLocation[]>(() => {
    const byId: Record<string, ServiceLocation> = {};
    const liveByGoogleId: Record<string, ServiceLocation> = {};

    for (const live of data.locations) {
      byId[live.id] = live;
      if (live.googlePlaceId) {
        liveByGoogleId[live.googlePlaceId] = live;
      }
    }

    const allGooglePlaces: DiscoveredGooglePlace[] = [
      ...nearby.places,
      ...Object.values(inspectedPlaces),
    ];

    for (const gp of allGooglePlaces) {
      const matchedLive = liveByGoogleId[gp.googlePlaceId] || byId[`gp_${gp.googlePlaceId}`];
      if (matchedLive) {
        // Enrich live venue with real Google Place photo, open status, and rating if available
        byId[matchedLive.id] = {
          ...matchedLive,
          photoUrl: matchedLive.photoUrl || gp.photoUrl,
          isOpenNow: gp.isOpenNow ?? matchedLive.isOpenNow ?? null,
          businessStatus: gp.businessStatus || matchedLive.businessStatus,
          rating: gp.rating ?? matchedLive.rating ?? null,
        };
      } else {
        const unavailableLoc = googlePlaceToUnavailableLocation(gp);
        byId[unavailableLoc.id] = unavailableLoc;
      }
    }

    return Object.values(byId);
  }, [data.locations, nearby.places, inspectedPlaces]);

  const selectedLocation = useMemo(() => {
    if (!data.selectedLocationId) return mergedLocations[0] || null;
    return mergedLocations.find((l) => l.id === data.selectedLocationId) || null;
  }, [mergedLocations, data.selectedLocationId]);

  const currentToken = viewedToken
    ? data.userTokens.find((tk) => tk.id === viewedToken.id) || viewedToken
    : data.activeUserToken;

  const currentTokenLocation = useMemo(() => {
    if (!currentToken) return null;
    return mergedLocations.find((l) => l.id === currentToken.locationId) || null;
  }, [currentToken, mergedLocations]);

  const navigate = useCallback((next: AppScreen) => {
    if (next !== 'splash') {
      localStorage.setItem('qlite_onboarded', '1');
    }
    setScreen(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const recordRecentlyViewed = useCallback((entry: RecentlyViewedLocation) => {
    setRecentlyViewed((prev) => {
      const filtered = prev.filter(
        (item) =>
          item.id !== entry.id &&
          (!entry.googlePlaceId || item.googlePlaceId !== entry.googlePlaceId)
      );
      const next = [entry, ...filtered].slice(0, 8);
      try {
        localStorage.setItem('qlite_recently_viewed', JSON.stringify(next));
      } catch {
        // Ignore storage quota errors
      }
      return next;
    });
  }, []);

  const handleOpenPlaceDetails = useCallback(
    (loc: ServiceLocation) => {
      recordRecentlyViewed({
        id: loc.id,
        googlePlaceId: loc.googlePlaceId,
        name: loc.name,
        address: loc.address,
        category: loc.category,
        lat: loc.lat,
        lng: loc.lng,
        photoUrl: loc.photoUrl,
        isOpenNow: loc.isOpenNow ?? null,
        viewedAtMs: Date.now(),
      });
      data.setSelectedLocationId(loc.id);
      setRouteEstimate(null);
      navigate('place_details');
    },
    [data, navigate, recordRecentlyViewed]
  );

  const handleSelectGooglePlace = useCallback(
    (gp: DiscoveredGooglePlace) => {
      setInspectedPlaces((prev) => ({ ...prev, [gp.googlePlaceId]: gp }));
      const existingLive = data.locations.find(
        (l) => l.googlePlaceId === gp.googlePlaceId || l.id === `gp_${gp.googlePlaceId}`
      );
      const targetId = existingLive ? existingLive.id : `gp_${gp.googlePlaceId}`;
      recordRecentlyViewed({
        id: targetId,
        googlePlaceId: gp.googlePlaceId,
        name: gp.name,
        address: gp.address,
        category: gp.category,
        lat: gp.lat,
        lng: gp.lng,
        photoUrl: gp.photoUrl,
        isOpenNow: gp.isOpenNow ?? null,
        viewedAtMs: Date.now(),
      });
      data.setSelectedLocationId(targetId);
      setRouteEstimate(null);
      navigate('place_details');
    },
    [data, navigate, recordRecentlyViewed]
  );

  const handleStartBooking = useCallback(() => {
    if (!selectedLocation?.hasLiveCrowdData) {
      showToast('Live crowd/queue feed is not connected to this venue.');
      return;
    }
    if (!data.user) {
      setPostAuthScreen('booking');
      navigate('auth');
      return;
    }
    navigate('booking');
  }, [selectedLocation, data.user, navigate, showToast]);

  const handleConfirmBooking = useCallback(
    async (serviceName: string, slotLabel: string, priorityTier: PriorityTier) => {
      if (!selectedLocation) return;
      const token = await data.bookToken(selectedLocation, serviceName, slotLabel, priorityTier);
      setViewedToken(token);
      navigate('digital_token');
    },
    [selectedLocation, data, navigate]
  );

  const handleConnectLocationQueue = useCallback(
    (loc: ServiceLocation) => {
      setStaffPrefillPlace({
        googlePlaceId: loc.googlePlaceId || loc.id.replace(/^gp_/, ''),
        name: loc.name,
        address: loc.address,
        lat: loc.lat,
        lng: loc.lng,
        category: loc.category,
        operatingHours: loc.operatingHours,
        photoUrl: loc.photoUrl,
      });
      if (!data.user) {
        setPostAuthScreen('staff_dashboard');
        navigate('auth');
        return;
      }
      navigate('staff_dashboard');
    },
    [data.user, navigate]
  );

  const handleQuickRegisterGooglePlace = useCallback(
    (place: DiscoveredGooglePlace) => {
      setStaffPrefillPlace(place);
      if (!data.user) {
        setPostAuthScreen('staff_dashboard');
        navigate('auth');
        return;
      }
      navigate('staff_dashboard');
    },
    [data.user, navigate]
  );

  const isSplash = screen === 'splash';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Google Maps Demo Key Quota Warning Banner (Case A) */}
      {mapsQuotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Navigation Bar */}
      {!isSplash && (
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/90">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
            <button
              type="button"
              onClick={() => navigate('home')}
              className="inline-flex items-center gap-2 text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 font-display"
            >
              <span className="w-7 h-7 rounded-lg smart-navy-hero text-white text-xs font-extrabold flex items-center justify-center shadow-xs">
                Q
              </span>
              <span>{t.appName}</span>
            </button>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
              <button
                type="button"
                onClick={() => navigate('home')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  screen === 'home' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
                }`}
              >
                {t.nav.home}
              </button>
              <button
                type="button"
                onClick={() => {
                  setExploreWithRoute(false);
                  navigate('explore');
                }}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  screen === 'explore' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
                }`}
              >
                {t.nav.explore}
              </button>
              <button
                type="button"
                onClick={() => navigate('live_queue')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  screen === 'live_queue' || screen === 'digital_token'
                    ? 'text-blue-700 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t.nav.liveQueue}
              </button>
              <button
                type="button"
                onClick={() => navigate('history')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  screen === 'history' ? 'text-blue-700 font-semibold underline underline-offset-8' : ''
                }`}
              >
                {t.nav.history}
              </button>
              <button
                type="button"
                onClick={() => navigate('staff_dashboard')}
                className={`whitespace-nowrap shrink-0 transition-colors hover:text-slate-900 ${
                  screen === 'staff_dashboard' || screen === 'reports'
                    ? 'text-blue-700 font-semibold underline underline-offset-8'
                    : ''
                }`}
              >
                {t.nav.staff}
              </button>
            </nav>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => navigate(data.user ? 'profile' : 'auth')}
                className="min-h-[40px] px-4 py-1.5 rounded-lg bg-blue-700 text-white text-xs font-semibold hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0"
              >
                {data.user ? t.nav.profile : 'Sign In'}
              </button>
            </div>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className={!isSplash ? 'flex-1 pb-20 md:pb-10' : 'flex-1'}>
        {screen === 'splash' && (
          <SplashScreen
            t={t}
            onContinue={() => navigate('home')}
            onChooseLanguage={() => navigate('language')}
          />
        )}

        {screen === 'language' && (
          <LanguageSelectionScreen
            currentLanguage={language}
            t={t}
            onSelectLanguage={handleLanguageChange}
            onContinue={() => navigate(data.user ? 'home' : 'auth')}
          />
        )}

        {screen === 'auth' && (
          <AuthScreen
            user={data.user}
            profile={data.profile}
            t={t}
            busy={data.busyAction === 'auth'}
            onGoogleSignIn={data.signInWithGoogle}
            onSaveProfile={async (name, phone) => {
              await data.updateProfileSettings({ displayName: name, phoneNumber: phone });
            }}
            onContinue={() => navigate(postAuthScreen)}
          />
        )}

        {screen === 'home' && (
          <HomeScreen
            userName={data.profile?.displayName || data.user?.displayName || null}
            locations={mergedLocations}
            recentlyViewed={recentlyViewed}
            userCenter={userCenter}
            gpsActive={gpsActive}
            gpsPermission={gpsPermission}
            areaLabel={areaLabel}
            category={categoryFilter}
            radiusKm={radiusKm}
            nearbyLoading={nearby.loading}
            nearbyError={nearby.error}
            activeToken={data.activeUserToken}
            t={t}
            onCategoryChange={setCategoryFilter}
            onRadiusChange={setRadiusKm}
            onRequestGps={handleRequestGps}
            onMoveArea={handleMoveArea}
            onRefreshNearby={nearby.refresh}
            onSearchPlacesByText={async (q) => {
              await nearby.searchByText(q);
            }}
            onSelectLocation={handleOpenPlaceDetails}
            onSelectGooglePlace={handleSelectGooglePlace}
            onOpenLocationOnMap={(loc) => {
              data.setSelectedLocationId(loc.id);
              setExploreWithRoute(true);
              navigate('explore');
            }}
            onOpenLiveQueue={() => {
              setViewedToken(data.activeUserToken);
              navigate('live_queue');
            }}
            onOpenExplore={() => {
              setExploreWithRoute(false);
              navigate('explore');
            }}
            onJoinOrConnectLocation={(loc) => {
              if (loc.hasLiveCrowdData) {
                data.setSelectedLocationId(loc.id);
                if (!data.user) {
                  setPostAuthScreen('booking');
                  navigate('auth');
                  return;
                }
                navigate('booking');
              } else {
                handleConnectLocationQueue(loc);
              }
            }}
          />
        )}

        {screen === 'explore' && (
          <ExploreScreen
            locations={mergedLocations}
            userCenter={userCenter}
            gpsActive={gpsActive}
            gpsPermission={gpsPermission}
            areaLabel={areaLabel}
            category={categoryFilter}
            radiusKm={radiusKm}
            nearbyLoading={nearby.loading}
            nearbyError={nearby.error}
            initialSelectedLocation={selectedLocation}
            initialShowRoute={exploreWithRoute}
            t={t}
            onCategoryChange={setCategoryFilter}
            onRadiusChange={setRadiusKm}
            onRequestGps={handleRequestGps}
            onMoveArea={handleMoveArea}
            onRefreshNearby={nearby.refresh}
            onOpenDetails={handleOpenPlaceDetails}
            onSelectDiscoveredPlace={handleSelectGooglePlace}
            onQuickRegisterGooglePlace={handleQuickRegisterGooglePlace}
          />
        )}

        {screen === 'place_details' && selectedLocation && (
          <PlaceDetailsScreen
            location={selectedLocation}
            allLocations={mergedLocations}
            userCenter={userCenter}
            isFavorite={Boolean(data.profile?.favoriteLocationIds.includes(selectedLocation.id))}
            existingActiveToken={data.activeUserToken}
            routeEstimate={routeEstimate}
            t={t}
            onBack={() => navigate('home')}
            onToggleFavorite={() => {
              if (!data.user) {
                setPostAuthScreen('place_details');
                navigate('auth');
                return;
              }
              data.toggleFavoriteLocation(selectedLocation.id);
            }}
            onStartBooking={handleStartBooking}
            onConnectLiveQueue={handleConnectLocationQueue}
            onSelectOtherBranch={handleOpenPlaceDetails}
            onOpenLiveQueue={() => {
              setViewedToken(data.activeUserToken);
              navigate('live_queue');
            }}
            onOpenExploreWithRoute={() => {
              setExploreWithRoute(true);
              navigate('explore');
            }}
          />
        )}

        {screen === 'booking' && selectedLocation && (
          <BookingScreen
            location={selectedLocation}
            userCenter={userCenter}
            existingActiveToken={data.activeUserToken}
            busy={data.busyAction === 'book'}
            t={t}
            onBack={() => navigate('place_details')}
            onConfirmBooking={handleConfirmBooking}
          />
        )}

        {screen === 'digital_token' && (
          <DigitalTokenScreen
            token={currentToken}
            location={currentTokenLocation}
            activeLocationTokens={data.locationActiveTokens}
            userCenter={userCenter}
            busy={data.busyAction === 'cancel'}
            t={t}
            onOpenLiveQueue={() => navigate('live_queue')}
            onCancelToken={async (tok) => {
              await data.cancelToken(tok);
              showToast('Token cancelled.');
              navigate('history');
            }}
            onExplore={() => navigate('home')}
          />
        )}

        {screen === 'live_queue' && (
          <LiveQueueScreen
            token={currentToken}
            location={currentTokenLocation}
            activeLocationTokens={data.locationActiveTokens}
            userCenter={userCenter}
            busy={data.busyAction === 'cancel'}
            t={t}
            onCancelToken={async (tok) => {
              await data.cancelToken(tok);
              showToast('Token cancelled.');
              navigate('history');
            }}
            onExplore={() => navigate('home')}
          />
        )}

        {screen === 'notifications' && (
          <NotificationsScreen
            notifications={data.notifications}
            t={t}
            onMarkAllRead={data.markAllNotificationsRead}
          />
        )}

        {screen === 'history' && (
          <BookingHistoryScreen
            tokens={data.userTokens}
            locations={mergedLocations}
            t={t}
            onOpenToken={(tok) => {
              setViewedToken(tok);
              data.setSelectedLocationId(tok.locationId);
              navigate('digital_token');
            }}
            onBookAgain={handleOpenPlaceDetails}
          />
        )}

        {screen === 'profile' && (
          <ProfileSettingsScreen
            user={data.user}
            profile={data.profile}
            language={language}
            locations={mergedLocations}
            t={t}
            onChangeLanguage={handleLanguageChange}
            onUpdateProfile={data.updateProfileSettings}
            onSelectFavorite={handleOpenPlaceDetails}
            onOpenAuth={() => {
              setPostAuthScreen('profile');
              navigate('auth');
            }}
            onOpenStaffDashboard={() => navigate('staff_dashboard')}
            onSignOut={async () => {
              await data.signOutUser();
              navigate('home');
            }}
          />
        )}

        {screen === 'staff_dashboard' && (
          <StaffDashboardScreen
            user={data.user}
            managedLocations={data.managedLocations}
            activeStaffLocation={data.activeStaffLocation}
            nearbyGooglePlaces={nearby.places}
            prefillPlace={staffPrefillPlace}
            staffTokens={data.staffAllTokens}
            userCenter={userCenter}
            busyAction={data.busyAction}
            t={t}
            onClearPrefillPlace={() => setStaffPrefillPlace(null)}
            onSelectStaffLocation={data.setStaffLocationId}
            onOpenAuth={() => {
              setPostAuthScreen('staff_dashboard');
              navigate('auth');
            }}
            onOpenReports={() => navigate('reports')}
            onRegisterLocation={data.registerLocation}
            onCallNext={data.callNextToken}
            onCompleteToken={data.completeToken}
            onSkipToken={data.skipToken}
            onCheckInQr={data.checkInTokenByQr}
            onUpdateState={data.updateStaffLocationState}
          />
        )}

        {screen === 'reports' && (
          <ReportsScreen
            locations={mergedLocations}
            staffTokens={data.staffAllTokens}
            activeStaffLocation={data.activeStaffLocation}
            t={t}
            onBackToStaff={() => navigate('staff_dashboard')}
          />
        )}
      </main>

      {/* Quiet Desktop Utility Footer */}
      {!isSplash && (
        <footer className="hidden md:block border-t border-slate-200 bg-white">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-slate-500">
            <span>QLite · {t.tagline}</span>
            <div className="flex items-center gap-6">
              <button
                type="button"
                onClick={() => navigate('notifications')}
                className="hover:text-slate-900"
              >
                {t.nav.alerts} {data.unreadNotificationCount > 0 ? `(${data.unreadNotificationCount})` : ''}
              </button>
              <button
                type="button"
                onClick={() => navigate('language')}
                className="hover:text-slate-900"
              >
                {t.chooseLanguage}
              </button>
              <button
                type="button"
                onClick={() => navigate('reports')}
                className="hover:text-slate-900"
              >
                {t.nav.reports}
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Mobile Bottom Thumb-Zone Navigation Bar */}
      {!isSplash && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 pb-safe">
          <div className="grid grid-cols-5 items-center h-14">
            <button
              type="button"
              onClick={() => navigate('home')}
              className={`flex flex-col items-center justify-center h-full ${
                screen === 'home' ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <Home className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {t.nav.home}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('explore')}
              className={`flex flex-col items-center justify-center h-full ${
                screen === 'explore' ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <Compass className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {t.nav.explore}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('live_queue')}
              className={`flex flex-col items-center justify-center h-full ${
                screen === 'live_queue' || screen === 'digital_token'
                  ? 'text-blue-700'
                  : 'text-slate-500'
              }`}
            >
              <Activity className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {t.nav.liveQueue}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('notifications')}
              className={`flex flex-col items-center justify-center h-full relative ${
                screen === 'notifications' ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <Bell className="w-5 h-5" />
              {data.unreadNotificationCount > 0 && (
                <span className="absolute top-1.5 right-4 w-2 h-2 rounded-full bg-red-600" />
              )}
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {t.nav.alerts}
              </span>
            </button>
            <button
              type="button"
              onClick={() => navigate('history')}
              className={`flex flex-col items-center justify-center h-full ${
                screen === 'history' || screen === 'profile' ? 'text-blue-700' : 'text-slate-500'
              }`}
            >
              <History className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-0.5 truncate max-w-[64px]">
                {t.nav.history}
              </span>
            </button>
          </div>
        </nav>
      )}

      {toastMsg && (
        <div className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white px-4 py-2.5 rounded-xl text-xs font-medium shadow-lg">
          {toastMsg}
        </div>
      )}
    </div>
  );
}

export default function App() {
  const [language, setLanguage] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('qlite_lang') as LanguageCode | null;
    return saved || 'en';
  });

  if (MAPS_API_KEY) {
    return (
      <APIProvider
        apiKey={MAPS_API_KEY}
        libraries={['places', 'routes', 'marker']}
        language={language}
        region="IN"
      >
        <AppContent language={language} onChangeLanguageState={setLanguage} />
      </APIProvider>
    );
  }

  return <AppContent language={language} onChangeLanguageState={setLanguage} />;
}
