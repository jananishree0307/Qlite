import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { User, getRedirectResult, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  collection,
  collectionGroup,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import {
  OperationType,
  auth,
  db,
  formatFirebaseAuthError,
  googleProvider,
  handleFirestoreError,
} from '../lib/firebase';
import {
  computeCrowdLevel,
  computeCrowdPercentage,
  computeTokenPosition,
  formatTokenCode,
  getPriorityWeight,
  normalizeCrowdLevel,
  sortWaitingQueueFairly,
  triggerBrowserNotification,
} from '../lib/queueEngine';
import { initFcmAndGetToken } from '../lib/fcm';
import {
  BLUEPRINT_LIMITS,
  CrowdLevel,
  LanguageCode,
  NotificationType,
  PriorityTier,
  QueueToken,
  ServiceCategory,
  ServiceLocation,
  UserNotification,
  UserProfile,
  makeSafeId,
  parseTokenQrPayload,
  sanitizeString,
} from '../types/qlite';

function tsToMs(val: unknown): number {
  if (!val) return Date.now();
  if (typeof val === 'number') return val;
  if (typeof val === 'object' && val !== null && 'toMillis' in val) {
    return (val as { toMillis: () => number }).toMillis();
  }
  return Date.now();
}

export function useQLiteData() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [firestoreLocations, setFirestoreLocations] = useState<ServiceLocation[]>([]);
  const [userTokens, setUserTokens] = useState<QueueToken[]>([]);
  const [locationActiveTokens, setLocationActiveTokens] = useState<QueueToken[]>([]);
  const [staffAllTokens, setStaffAllTokens] = useState<QueueToken[]>([]);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [staffLocationId, setStaffLocationId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const alertedStagesRef = useRef<Record<string, boolean>>({});

  // Verified live provider locations from Firestore only (no demo/fabricated fallback venues)
  const locations = useMemo<ServiceLocation[]>(() => {
    return firestoreLocations.filter((l) => l.hasLiveCrowdData);
  }, [firestoreLocations]);

  // Listen to Firebase Auth
  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      setAuthError(formatFirebaseAuthError(err));
    });
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) setAuthError(null);
      setAuthReady(true);
    });
    return () => unsub();
  }, []);

  // Listen to active ServiceLocations (publicly readable where isActive == true)
  useEffect(() => {
    const q = query(collection(db, 'locations'), where('isActive', '==', true));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: ServiceLocation[] = snap.docs.map((d) => {
          const data = d.data();
          const isVerifiedLive = data.dataSource === 'live_provider';
          const waitingCount = isVerifiedLive ? Number(data.waitingCount || 0) : null;
          const maxCapacity = data.maxCapacity ? Number(data.maxCapacity) : 35;
          const crowdPct = isVerifiedLive
            ? typeof data.crowdPercentage === 'number'
              ? Math.min(100, Math.max(0, Math.round(data.crowdPercentage)))
              : computeCrowdPercentage(waitingCount || 0, maxCapacity)
            : null;
          const crowdLevel = isVerifiedLive
            ? normalizeCrowdLevel(data.crowdLevel as string | null) ||
              computeCrowdLevel(waitingCount || 0, crowdPct)
            : null;

          return {
            id: d.id,
            ownerId: String(data.ownerId || ''),
            googlePlaceId: data.googlePlaceId ? String(data.googlePlaceId) : undefined,
            name: String(data.name || ''),
            organizationGroup: String(data.organizationGroup || ''),
            category: (data.category as ServiceCategory) || 'other',
            address: String(data.address || ''),
            lat: Number(data.lat || 0),
            lng: Number(data.lng || 0),
            operatingHours: String(data.operatingHours || ''),
            hasLiveCrowdData: isVerifiedLive,
            crowdLevel,
            crowdPercentage: crowdPct,
            maxCapacity,
            waitingCount,
            avgServiceMinutes: Number(data.avgServiceMinutes || 4),
            delayMinutes: Number(data.delayMinutes || 0),
            currentlyServingNumber: isVerifiedLive ? Number(data.currentlyServingNumber || 0) : null,
            lastTokenSequence: Number(data.lastTokenSequence || 0),
            currentlyServingCode: isVerifiedLive ? String(data.currentlyServingCode || 'T-000') : null,
            isPaused: Boolean(data.isPaused),
            isActive: Boolean(data.isActive),
            dataSource: isVerifiedLive ? 'live_provider' : 'google_places',
            services: Array.isArray(data.services) ? data.services.map(String) : ['General Queue'],
            counters: Array.isArray(data.counters) ? data.counters.map(String) : ['Counter 1'],
            imageKey: data.imageKey ? String(data.imageKey) : undefined,
            bestTimeNote: data.bestTimeNote ? String(data.bestTimeNote) : undefined,
            updatedAtMs: isVerifiedLive ? tsToMs(data.updatedAt) : null,
          };
        });
        setFirestoreLocations(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, 'locations');
      }
    );
    return () => unsub();
  }, []);

  // Listen to & initialize User Profile when signed in
  useEffect(() => {
    if (!authReady || !user) {
      setProfile(null);
      return;
    }

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        if (!snap.exists()) {
          const safeDisplayName =
            sanitizeString(user.displayName || '', BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'QLite User';
          const initialProfile: UserProfile = {
            uid: user.uid,
            displayName: safeDisplayName,
            phoneNumber: '',
            email: sanitizeString(user.email || '', 120),
            language: (localStorage.getItem('qlite_lang') as LanguageCode) || 'en',
            role: 'user',
            favoriteLocationIds: [],
            notificationPrefs: {
              fiveAhead: true,
              turnReady: true,
              delays: true,
              browserPush: false,
            },
          };
          try {
            await setDoc(userRef, {
              ...initialProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
          }
          return;
        }
        const data = snap.data();
        setProfile({
          uid: snap.id,
          displayName: String(data.displayName || 'QLite User'),
          phoneNumber: data.phoneNumber ? String(data.phoneNumber) : '',
          email: data.email ? String(data.email) : '',
          language: (data.language as LanguageCode) || 'en',
          role: data.role === 'staff' ? 'staff' : 'user',
          favoriteLocationIds: Array.isArray(data.favoriteLocationIds)
            ? data.favoriteLocationIds.map(String)
            : [],
          notificationPrefs: {
            fiveAhead: data.notificationPrefs?.fiveAhead !== false,
            turnReady: data.notificationPrefs?.turnReady !== false,
            delays: data.notificationPrefs?.delays !== false,
            browserPush: Boolean(data.notificationPrefs?.browserPush),
          },
          fcmToken: data.fcmToken ? String(data.fcmToken) : undefined,
        });
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Listen to User's own Tokens across all locations (collectionGroup query)
  useEffect(() => {
    if (!authReady || !user) {
      setUserTokens([]);
      return;
    }

    const q = query(collectionGroup(db, 'tokens'), where('userId', '==', user.uid));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QueueToken[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              locationId: String(data.locationId || ''),
              locationOwnerId: String(data.locationOwnerId || ''),
              locationName: String(data.locationName || ''),
              userId: String(data.userId || ''),
              holderLabel: String(data.holderLabel || ''),
              tokenCode: String(data.tokenCode || ''),
              sequenceNumber: Number(data.sequenceNumber || 0),
              serviceName: String(data.serviceName || ''),
              slotLabel: String(data.slotLabel || ''),
              priorityTier: (data.priorityTier as PriorityTier) || 'standard',
              priorityWeight: Number(data.priorityWeight || 0),
              status: data.status || 'waiting',
              counterName: data.counterName ? String(data.counterName) : undefined,
              skipReason: data.skipReason ? String(data.skipReason) : undefined,
              estimatedWaitMinutes: Number(data.estimatedWaitMinutes || 0),
              createdAtMs: tsToMs(data.createdAt),
              updatedAtMs: tsToMs(data.updatedAt),
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setUserTokens(list);
      },
      (err) => {
        const code = (err as { code?: string })?.code;
        if (code === 'failed-precondition') {
          // Fallback to per-location token queries if collectionGroup index is not yet provisioned
          void Promise.all(
            firestoreLocations.map((loc) =>
              getDocs(
                query(collection(db, 'locations', loc.id, 'tokens'), where('userId', '==', user.uid))
              ).catch(() => null)
            )
          ).then((snaps) => {
            const merged: QueueToken[] = [];
            snaps.forEach((s) => {
              if (!s) return;
              s.docs.forEach((d) => {
                const data = d.data();
                merged.push({
                  id: d.id,
                  locationId: String(data.locationId || ''),
                  locationOwnerId: String(data.locationOwnerId || ''),
                  locationName: String(data.locationName || ''),
                  userId: String(data.userId || ''),
                  holderLabel: String(data.holderLabel || ''),
                  tokenCode: String(data.tokenCode || ''),
                  sequenceNumber: Number(data.sequenceNumber || 0),
                  serviceName: String(data.serviceName || ''),
                  slotLabel: String(data.slotLabel || ''),
                  priorityTier: (data.priorityTier as PriorityTier) || 'standard',
                  priorityWeight: Number(data.priorityWeight || 0),
                  status: data.status || 'waiting',
                  counterName: data.counterName ? String(data.counterName) : undefined,
                  skipReason: data.skipReason ? String(data.skipReason) : undefined,
                  estimatedWaitMinutes: Number(data.estimatedWaitMinutes || 0),
                  createdAtMs: tsToMs(data.createdAt),
                  updatedAtMs: tsToMs(data.updatedAt),
                });
              });
            });
            setUserTokens(merged.sort((a, b) => b.createdAtMs - a.createdAtMs));
          });
          return;
        }
        handleFirestoreError(err, OperationType.LIST, 'tokens(collectionGroup)');
      }
    );

    return () => unsub();
  }, [authReady, user, firestoreLocations]);

  // Listen to User's Notifications
  useEffect(() => {
    if (!authReady || !user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'users', user.uid, 'notifications'),
      where('userId', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: UserNotification[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              userId: String(data.userId || ''),
              locationId: String(data.locationId || ''),
              tokenId: data.tokenId ? String(data.tokenId) : undefined,
              type: (data.type as NotificationType) || 'booking',
              title: String(data.title || ''),
              message: String(data.message || ''),
              read: Boolean(data.read),
              createdAtMs: tsToMs(data.createdAt),
            };
          })
          .sort((a, b) => b.createdAtMs - a.createdAtMs);
        setNotifications(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/notifications`);
      }
    );

    return () => unsub();
  }, [authReady, user]);

  // Listen to active queue tokens for the currently watched location (only when it exists in Firestore)
  const activeUserToken = useMemo(
    () =>
      userTokens.find(
        (t) => t.status === 'in_progress' || t.status === 'serving' || t.status === 'waiting'
      ) || null,
    [userTokens]
  );

  const watchedLocationId = selectedLocationId || activeUserToken?.locationId || null;
  const watchedIsFirestore = useMemo(
    () => Boolean(watchedLocationId && firestoreLocations.some((l) => l.id === watchedLocationId)),
    [watchedLocationId, firestoreLocations]
  );

  useEffect(() => {
    if (!authReady || !user || !watchedLocationId || !watchedIsFirestore) {
      setLocationActiveTokens([]);
      return;
    }

    const q = query(
      collection(db, 'locations', watchedLocationId, 'tokens'),
      where('status', 'in', ['waiting', 'in_progress', 'serving'])
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QueueToken[] = snap.docs.map((d) => {
          const data = d.data();
          return {
            id: d.id,
            locationId: String(data.locationId || ''),
            locationOwnerId: String(data.locationOwnerId || ''),
            locationName: String(data.locationName || ''),
            userId: String(data.userId || ''),
            holderLabel: String(data.holderLabel || ''),
            tokenCode: String(data.tokenCode || ''),
            sequenceNumber: Number(data.sequenceNumber || 0),
            serviceName: String(data.serviceName || ''),
            slotLabel: String(data.slotLabel || ''),
            priorityTier: (data.priorityTier as PriorityTier) || 'standard',
            priorityWeight: Number(data.priorityWeight || 0),
            status: data.status || 'waiting',
            counterName: data.counterName ? String(data.counterName) : undefined,
            skipReason: data.skipReason ? String(data.skipReason) : undefined,
            estimatedWaitMinutes: Number(data.estimatedWaitMinutes || 0),
            createdAtMs: tsToMs(data.createdAt),
            updatedAtMs: tsToMs(data.updatedAt),
          };
        });
        setLocationActiveTokens(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `locations/${watchedLocationId}/tokens`);
      }
    );
    return () => unsub();
  }, [authReady, user, watchedLocationId, watchedIsFirestore]);

  // Listen to ALL tokens for Staff Dashboard & Reports for selected staff location
  const isAdminUser = user?.email === 'jananishree0307@gmail.com' && user?.emailVerified;

  const managedLocations = useMemo(() => {
    if (!user) return [];
    if (isAdminUser) return locations;
    return locations.filter((l) => l.ownerId === user.uid);
  }, [user, isAdminUser, locations]);

  const activeStaffLocation = useMemo(() => {
    if (staffLocationId) {
      return managedLocations.find((l) => l.id === staffLocationId) || managedLocations[0] || null;
    }
    return managedLocations[0] || null;
  }, [managedLocations, staffLocationId]);

  useEffect(() => {
    if (!authReady || !user || !activeStaffLocation) {
      setStaffAllTokens([]);
      return;
    }

    const canManage = isAdminUser || activeStaffLocation.ownerId === user.uid;
    if (!canManage) {
      setStaffAllTokens([]);
      return;
    }

    const tokensRef = collection(db, 'locations', activeStaffLocation.id, 'tokens');
    const q = isAdminUser
      ? query(tokensRef)
      : query(tokensRef, where('locationOwnerId', '==', user.uid));

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: QueueToken[] = snap.docs
          .map((d) => {
            const data = d.data();
            return {
              id: d.id,
              locationId: String(data.locationId || ''),
              locationOwnerId: String(data.locationOwnerId || ''),
              locationName: String(data.locationName || ''),
              userId: String(data.userId || ''),
              holderLabel: String(data.holderLabel || ''),
              tokenCode: String(data.tokenCode || ''),
              sequenceNumber: Number(data.sequenceNumber || 0),
              serviceName: String(data.serviceName || ''),
              slotLabel: String(data.slotLabel || ''),
              priorityTier: (data.priorityTier as PriorityTier) || 'standard',
              priorityWeight: Number(data.priorityWeight || 0),
              status: data.status || 'waiting',
              counterName: data.counterName ? String(data.counterName) : undefined,
              skipReason: data.skipReason ? String(data.skipReason) : undefined,
              estimatedWaitMinutes: Number(data.estimatedWaitMinutes || 0),
              createdAtMs: tsToMs(data.createdAt),
              updatedAtMs: tsToMs(data.updatedAt),
            };
          })
          .sort((a, b) => a.sequenceNumber - b.sequenceNumber);
        setStaffAllTokens(list);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `locations/${activeStaffLocation.id}/tokens`);
      }
    );

    return () => unsub();
  }, [authReady, user, activeStaffLocation, isAdminUser]);

  // Automatic queue milestone alerts
  const pushUserNotification = useCallback(
    async (
      targetUserId: string,
      locationId: string,
      type: NotificationType,
      title: string,
      message: string,
      tokenId?: string
    ) => {
      if (!user) return;
      const locExists = firestoreLocations.some((l) => l.id === locationId);
      if (!locExists) return;
      const notifId = makeSafeId(`ntf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const notifRef = doc(db, 'users', targetUserId, 'notifications', notifId);
      try {
        await setDoc(notifRef, {
          id: notifId,
          userId: targetUserId,
          locationId,
          ...(tokenId ? { tokenId } : {}),
          type,
          title: sanitizeString(title, BLUEPRINT_LIMITS.NOTIF_TITLE_MAX),
          message: sanitizeString(message, BLUEPRINT_LIMITS.NOTIF_MESSAGE_MAX),
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `users/${targetUserId}/notifications/${notifId}`);
      }
    },
    [user, firestoreLocations]
  );

  useEffect(() => {
    if (!user || !activeUserToken || !profile) return;
    const loc = locations.find((l) => l.id === activeUserToken.locationId);
    if (!loc) return;

    const { peopleAhead } = computeTokenPosition(activeUserToken, locationActiveTokens, loc);

    const hasFired = (stage: string, type: NotificationType): boolean => {
      const cacheKey = `qlite_alert_${activeUserToken.id}_${stage}`;
      if (alertedStagesRef.current[cacheKey]) return true;
      try {
        if (localStorage.getItem(cacheKey) === '1') {
          alertedStagesRef.current[cacheKey] = true;
          return true;
        }
      } catch {
        // Ignore storage restrictions
      }
      if (notifications.some((n) => n.tokenId === activeUserToken.id && n.type === type)) {
        alertedStagesRef.current[cacheKey] = true;
        return true;
      }
      return false;
    };

    const markFired = (stage: string) => {
      const cacheKey = `qlite_alert_${activeUserToken.id}_${stage}`;
      alertedStagesRef.current[cacheKey] = true;
      try {
        localStorage.setItem(cacheKey, '1');
      } catch {
        // Ignore storage restrictions
      }
    };

    if (activeUserToken.status === 'serving' || activeUserToken.status === 'in_progress') {
      if (!hasFired('turn', 'your_turn') && profile.notificationPrefs.turnReady) {
        markFired('turn');
        if (profile.notificationPrefs.browserPush) {
          void triggerBrowserNotification(
            `It's your turn! (${activeUserToken.tokenCode})`,
            `Proceed to ${activeUserToken.counterName || 'the counter'} at ${loc.name}.`,
            `${activeUserToken.id}_turn`
          );
        }
      }
    } else if (activeUserToken.status === 'waiting') {
      if (peopleAhead <= 1) {
        if (!hasFired('next_1', 'approaching') && profile.notificationPrefs.turnReady) {
          markFired('next_1');
          void pushUserNotification(
            user.uid,
            loc.id,
            'approaching',
            `Your Token is Next — ${activeUserToken.tokenCode}`,
            peopleAhead === 0
              ? `You are up next at ${loc.name}! Please head to the counter.`
              : `Only 1 person is ahead of you at ${loc.name}. Get ready!`,
            activeUserToken.id
          );
          if (profile.notificationPrefs.browserPush) {
            void triggerBrowserNotification(
              `Your Token is Next (${activeUserToken.tokenCode})`,
              `${peopleAhead === 0 ? 'Next to be called' : '1 person ahead'} at ${loc.name}`,
              `${activeUserToken.id}_next`
            );
          }
        }
      } else if (peopleAhead === 2) {
        if (!hasFired('two', 'two_ahead') && profile.notificationPrefs.turnReady) {
          markFired('two');
          void pushUserNotification(
            user.uid,
            loc.id,
            'two_ahead',
            `2 People Ahead — ${activeUserToken.tokenCode}`,
            `Only 2 people ahead of you at ${loc.name}. Please be nearby.`,
            activeUserToken.id
          );
          if (profile.notificationPrefs.browserPush) {
            void triggerBrowserNotification(
              `2 People Ahead (${activeUserToken.tokenCode})`,
              `Your turn at ${loc.name} is coming right up.`,
              `${activeUserToken.id}_two`
            );
          }
        }
      } else if (peopleAhead <= 5) {
        if (!hasFired('five', 'five_ahead') && profile.notificationPrefs.fiveAhead) {
          markFired('five');
          void pushUserNotification(
            user.uid,
            loc.id,
            'five_ahead',
            `5 People Ahead — ${activeUserToken.tokenCode}`,
            `Your turn at ${loc.name} is getting close (${peopleAhead} ahead).`,
            activeUserToken.id
          );
          if (profile.notificationPrefs.browserPush) {
            void triggerBrowserNotification(
              `5 or Fewer Ahead (${activeUserToken.tokenCode})`,
              `${peopleAhead} people ahead at ${loc.name}`,
              `${activeUserToken.id}_five`
            );
          }
        }
      }
    }
  }, [user, activeUserToken, locationActiveTokens, locations, profile, notifications, pushUserNotification]);

  // Auth Actions
  const signInWithGoogle = useCallback(async () => {
    setBusyAction('auth');
    setAuthError(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      setUser(cred.user);
      return cred.user;
    } catch (err) {
      const message = formatFirebaseAuthError(err);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setBusyAction(null);
    }
  }, []);

  const signOutUser = useCallback(async () => {
    setBusyAction('auth');
    try {
      await signOut(auth);
      setAuthError(null);
    } finally {
      setBusyAction(null);
    }
  }, []);

  // Profile Actions
  const updateProfileSettings = useCallback(
    async (
      updates: Partial<
        Pick<
          UserProfile,
          'displayName' | 'phoneNumber' | 'language' | 'role' | 'favoriteLocationIds' | 'notificationPrefs'
        >
      >
    ) => {
      if (!user) return;
      const userRef = doc(db, 'users', user.uid);
      let nextFcmToken = profile?.fcmToken;
      if (updates.notificationPrefs?.browserPush) {
        const fcmRes = await initFcmAndGetToken();
        if (fcmRes.token) {
          nextFcmToken = sanitizeString(fcmRes.token, BLUEPRINT_LIMITS.FCM_TOKEN_MAX);
        }
      }
      const resolvedName =
        sanitizeString(
          updates.displayName ?? profile?.displayName ?? user.displayName ?? '',
          BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
        ) || 'QLite User';
      const resolvedPhone = sanitizeString(
        updates.phoneNumber ?? profile?.phoneNumber ?? '',
        BLUEPRINT_LIMITS.PHONE_MAX
      );
      const resolvedLang = updates.language ?? profile?.language ?? ((localStorage.getItem('qlite_lang') as LanguageCode) || 'en');
      const resolvedPrefs = updates.notificationPrefs ??
        profile?.notificationPrefs ?? {
          fiveAhead: true,
          turnReady: true,
          delays: true,
          browserPush: false,
        };
      const resolvedFavs = (updates.favoriteLocationIds ?? profile?.favoriteLocationIds ?? []).slice(
        0,
        BLUEPRINT_LIMITS.MAX_FAVORITES
      );

      try {
        if (!profile) {
          const existingSnap = await getDoc(userRef);
          if (!existingSnap.exists()) {
            await setDoc(userRef, {
              uid: user.uid,
              displayName: resolvedName,
              phoneNumber: resolvedPhone,
              email: sanitizeString(user.email || '', 120),
              language: resolvedLang,
              role: 'user',
              favoriteLocationIds: resolvedFavs,
              notificationPrefs: resolvedPrefs,
              ...(nextFcmToken ? { fcmToken: nextFcmToken } : {}),
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
            return;
          }
        }

        await updateDoc(userRef, {
          displayName: resolvedName,
          phoneNumber: resolvedPhone,
          language: resolvedLang,
          role: updates.role ?? profile?.role ?? 'user',
          favoriteLocationIds: resolvedFavs,
          notificationPrefs: resolvedPrefs,
          ...(nextFcmToken ? { fcmToken: nextFcmToken } : {}),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}`);
      }
    },
    [user, profile]
  );

  const toggleFavoriteLocation = useCallback(
    async (locationId: string) => {
      if (!user || !profile) return;
      const exists = profile.favoriteLocationIds.includes(locationId);
      const next = exists
        ? profile.favoriteLocationIds.filter((id) => id !== locationId)
        : [...profile.favoriteLocationIds, locationId].slice(0, BLUEPRINT_LIMITS.MAX_FAVORITES);
      await updateProfileSettings({ favoriteLocationIds: next });
    },
    [user, profile, updateProfileSettings]
  );

  const markAllNotificationsRead = useCallback(async () => {
    if (!user) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    const batch = writeBatch(db);
    unread.forEach((n) => {
      batch.update(doc(db, 'users', user.uid, 'notifications', n.id), { read: true });
    });
    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/notifications`);
    }
  }, [user, notifications]);

  // Join Queue / Book Digital Token (ONLY allowed on connected live_provider venues)
  const bookToken = useCallback(
    async (
      loc: ServiceLocation,
      serviceName: string,
      slotLabel: string,
      priorityTier: PriorityTier
    ): Promise<QueueToken> => {
      if (!user) throw new Error('Authentication required to book a token.');
      if (!loc.hasLiveCrowdData) {
        throw new Error('This venue does not have a connected live queue system.');
      }
      const duplicate = userTokens.find(
        (t) =>
          t.locationId === loc.id &&
          (t.status === 'waiting' || t.status === 'in_progress' || t.status === 'serving')
      );
      if (duplicate) {
        throw new Error('Duplicate token: You already have an active token at this venue.');
      }

      setBusyAction('book');
      try {
        const locRef = doc(db, 'locations', loc.id);
        const existingLocSnap = await getDoc(locRef);
        if (!existingLocSnap.exists()) {
          throw new Error('Authorized venue queue feed is not connected.');
        }

        const tokenId = makeSafeId(`tok_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        const tokenRef = doc(db, 'locations', loc.id, 'tokens', tokenId);

        const createdToken = await runTransaction(db, async (tx) => {
          const snap = await tx.get(locRef);
          if (!snap.exists()) {
            throw new Error('Location does not exist.');
          }
          const data = snap.data();
          if (data.isPaused) {
            throw new Error('Token booking is currently paused by this service provider.');
          }
          const nextSeq = Number(data.lastTokenSequence || 0) + 1;
          const nextWaiting = Number(data.waitingCount || 0) + 1;
          const maxCap = Number(data.maxCapacity || 35);
          const nextPct = computeCrowdPercentage(nextWaiting, maxCap);
          const nextCrowd = computeCrowdLevel(nextWaiting, nextPct);
          const code = formatTokenCode(nextSeq, priorityTier);
          const weight = getPriorityWeight(priorityTier);
          const counters = Array.isArray(data.counters) ? data.counters.length : 1;
          const estWait = Math.max(
            1,
            Math.round(
              (nextWaiting * Number(data.avgServiceMinutes || 4)) / Math.max(1, counters) +
                Number(data.delayMinutes || 0)
            )
          );

          tx.update(locRef, {
            lastTokenSequence: nextSeq,
            waitingCount: nextWaiting,
            crowdPercentage: nextPct,
            crowdLevel: nextCrowd,
            updatedAt: serverTimestamp(),
          });

          const holderLabel = sanitizeString(
            profile?.displayName || user.displayName || 'Visitor',
            60
          );

          const tokenDocData = {
            id: tokenId,
            locationId: loc.id,
            locationOwnerId: String(data.ownerId),
            locationName: sanitizeString(String(data.name), BLUEPRINT_LIMITS.LOCATION_NAME_MAX),
            userId: user.uid,
            holderLabel,
            tokenCode: code,
            sequenceNumber: nextSeq,
            serviceName: sanitizeString(serviceName, BLUEPRINT_LIMITS.SERVICE_NAME_MAX),
            slotLabel: sanitizeString(slotLabel, 60),
            priorityTier,
            priorityWeight: weight,
            status: 'waiting' as const,
            estimatedWaitMinutes: estWait,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          };

          tx.set(tokenRef, tokenDocData);

          return {
            ...tokenDocData,
            createdAtMs: Date.now(),
            updatedAtMs: Date.now(),
          } as QueueToken;
        });

        const notifId = makeSafeId(`ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
          id: notifId,
          userId: user.uid,
          locationId: loc.id,
          tokenId: createdToken.id,
          type: 'token_generated',
          title: `Token ${createdToken.tokenCode} Confirmed`,
          message: `Booked ${createdToken.serviceName} at ${createdToken.locationName}. Est. wait ~${createdToken.estimatedWaitMinutes} min.`,
          read: false,
          createdAt: serverTimestamp(),
        });

        return createdToken;
      } catch (err) {
        if (
          err instanceof Error &&
          (err.message.includes('Duplicate') ||
            err.message.includes('paused') ||
            err.message.includes('connected'))
        ) {
          throw err;
        }
        handleFirestoreError(err, OperationType.WRITE, `locations/${loc.id}/tokens`);
      } finally {
        setBusyAction(null);
      }
    },
    [user, userTokens, profile]
  );

  // Cancel Waiting Token
  const cancelToken = useCallback(
    async (token: QueueToken) => {
      if (!user) return;
      if (token.status !== 'waiting') {
        throw new Error('Only waiting tokens can be cancelled.');
      }
      setBusyAction('cancel');
      try {
        const locRef = doc(db, 'locations', token.locationId);
        const tokenRef = doc(db, 'locations', token.locationId, 'tokens', token.id);

        await runTransaction(db, async (tx) => {
          const [locSnap, tokSnap] = await Promise.all([tx.get(locRef), tx.get(tokenRef)]);
          if (!tokSnap.exists() || tokSnap.data().status !== 'waiting') {
            throw new Error('Token is no longer in waiting state.');
          }
          tx.update(tokenRef, {
            status: 'cancelled',
            updatedAt: serverTimestamp(),
          });
          if (locSnap.exists()) {
            const curWait = Number(locSnap.data().waitingCount || 0);
            const nextWait = Math.max(0, curWait - 1);
            const maxCap = Number(locSnap.data().maxCapacity || 35);
            const nextPct = computeCrowdPercentage(nextWait, maxCap);
            tx.update(locRef, {
              waitingCount: nextWait,
              crowdPercentage: nextPct,
              crowdLevel: computeCrowdLevel(nextWait, nextPct),
              updatedAt: serverTimestamp(),
            });
          }
        });

        const notifId = makeSafeId(`ntf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
        await setDoc(doc(db, 'users', user.uid, 'notifications', notifId), {
          id: notifId,
          userId: user.uid,
          locationId: token.locationId,
          tokenId: token.id,
          type: 'cancelled',
          title: `Token ${token.tokenCode} Cancelled`,
          message: `Your queue booking at ${token.locationName} was cancelled.`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        if (err instanceof Error && err.message.includes('waiting')) throw err;
        handleFirestoreError(err, OperationType.UPDATE, `locations/${token.locationId}/tokens/${token.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user]
  );

  // Staff: Connect a real-world Google Place (or authorized venue) to live QLite queue tracking
  const registerLocation = useCallback(
    async (input: {
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
    }): Promise<ServiceLocation> => {
      if (!user) throw new Error('Sign in required');
      setBusyAction('staff_register');
      try {
        const safeGoogleId = input.googlePlaceId ? makeSafeId(input.googlePlaceId) : undefined;
        const id = safeGoogleId
          ? makeSafeId(`gp_${safeGoogleId}`)
          : makeSafeId(`loc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

        const existingSnap = await getDoc(doc(db, 'locations', id));
        if (existingSnap.exists()) {
          setStaffLocationId(id);
          const existingMatch = firestoreLocations.find((l) => l.id === id);
          if (existingMatch) return existingMatch;
        }

        const maxCap = Math.max(1, Math.min(10000, input.maxCapacity || 35));
        const payload = {
          id,
          ownerId: user.uid,
          ...(safeGoogleId ? { googlePlaceId: safeGoogleId } : {}),
          name: sanitizeString(input.name, BLUEPRINT_LIMITS.LOCATION_NAME_MAX),
          organizationGroup: sanitizeString(input.organizationGroup || input.name, BLUEPRINT_LIMITS.ORG_GROUP_MAX),
          category: input.category,
          address: sanitizeString(input.address, BLUEPRINT_LIMITS.ADDRESS_MAX),
          lat: input.lat,
          lng: input.lng,
          operatingHours: sanitizeString(input.operatingHours, BLUEPRINT_LIMITS.HOURS_MAX),
          crowdLevel: 'low' as CrowdLevel,
          crowdPercentage: 0,
          maxCapacity: maxCap,
          waitingCount: 0,
          avgServiceMinutes: Math.max(1, Math.min(240, input.avgServiceMinutes)),
          delayMinutes: 0,
          currentlyServingNumber: 0,
          lastTokenSequence: 0,
          currentlyServingCode: 'T-000',
          isPaused: false,
          isActive: true,
          dataSource: 'live_provider' as const,
          services: input.services.slice(0, BLUEPRINT_LIMITS.MAX_SERVICES),
          counters: input.counters.slice(0, BLUEPRINT_LIMITS.MAX_COUNTERS),
          imageKey: input.category,
          bestTimeNote: 'Connected authorized queue counter',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        };
        await setDoc(doc(db, 'locations', id), payload);
        setStaffLocationId(id);
        return {
          ...payload,
          hasLiveCrowdData: true,
          updatedAtMs: Date.now(),
        };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, 'locations');
      } finally {
        setBusyAction(null);
      }
    },
    [user, firestoreLocations]
  );

  // Staff: Call Next Token (fair priority queue)
  const callNextToken = useCallback(
    async (loc: ServiceLocation, counterName: string) => {
      if (!user) return;
      setBusyAction('staff_call');
      try {
        const currentServing = staffAllTokens.find((t) => t.status === 'serving');
        const orderedWaiting = sortWaitingQueueFairly(
          staffAllTokens.filter((t) => t.status === 'waiting')
        );
        const nextTok = orderedWaiting[0];
        const batch = writeBatch(db);
        const locRef = doc(db, 'locations', loc.id);
        const maxCap = loc.maxCapacity || 35;

        if (currentServing) {
          batch.update(doc(db, 'locations', loc.id, 'tokens', currentServing.id), {
            status: 'completed',
            updatedAt: serverTimestamp(),
          });
        }

        if (nextTok) {
          batch.update(doc(db, 'locations', loc.id, 'tokens', nextTok.id), {
            status: 'serving',
            counterName: sanitizeString(counterName || loc.counters[0] || 'Counter 1', BLUEPRINT_LIMITS.COUNTER_NAME_MAX),
            updatedAt: serverTimestamp(),
          });
          const remainingWaiting = Math.max(0, orderedWaiting.length - 1);
          const nextPct = computeCrowdPercentage(remainingWaiting, maxCap);
          batch.update(locRef, {
            currentlyServingNumber: nextTok.sequenceNumber,
            currentlyServingCode: nextTok.tokenCode,
            waitingCount: remainingWaiting,
            crowdPercentage: nextPct,
            crowdLevel: computeCrowdLevel(remainingWaiting, nextPct),
            dataSource: 'live_provider',
            updatedAt: serverTimestamp(),
          });
        } else {
          batch.update(locRef, {
            waitingCount: 0,
            crowdPercentage: 0,
            crowdLevel: 'low',
            dataSource: 'live_provider',
            updatedAt: serverTimestamp(),
          });
        }

        await batch.commit();

        if (nextTok) {
          await pushUserNotification(
            nextTok.userId,
            loc.id,
            'your_turn',
            `Your Turn Now — ${nextTok.tokenCode}`,
            `Please proceed to ${counterName || loc.counters[0] || 'Counter 1'} at ${loc.name}.`,
            nextTok.id
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `locations/${loc.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user, staffAllTokens, pushUserNotification]
  );

  // Staff: Complete current serving token
  const completeToken = useCallback(
    async (loc: ServiceLocation, token: QueueToken) => {
      if (!user) return;
      setBusyAction('staff_complete');
      try {
        await updateDoc(doc(db, 'locations', loc.id, 'tokens', token.id), {
          status: 'completed',
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `locations/${loc.id}/tokens/${token.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user]
  );

  // Staff: Skip token with recorded reason
  const skipToken = useCallback(
    async (loc: ServiceLocation, token: QueueToken, reason: string) => {
      if (!user) return;
      setBusyAction('staff_skip');
      try {
        const batch = writeBatch(db);
        batch.update(doc(db, 'locations', loc.id, 'tokens', token.id), {
          status: 'skipped',
          skipReason: sanitizeString(reason || 'Not present at counter', BLUEPRINT_LIMITS.SKIP_REASON_MAX),
          updatedAt: serverTimestamp(),
        });
        if (token.status === 'waiting') {
          const nextWait = Math.max(0, (loc.waitingCount ?? 0) - 1);
          const nextPct = computeCrowdPercentage(nextWait, loc.maxCapacity || 35);
          batch.update(doc(db, 'locations', loc.id), {
            waitingCount: nextWait,
            crowdPercentage: nextPct,
            crowdLevel: computeCrowdLevel(nextWait, nextPct),
            dataSource: 'live_provider',
            updatedAt: serverTimestamp(),
          });
        }
        await batch.commit();

        await pushUserNotification(
          token.userId,
          loc.id,
          'skipped',
          `Token ${token.tokenCode} Skipped`,
          `Skipped at ${loc.name}: ${reason || 'Not present at counter'}.`,
          token.id
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `locations/${loc.id}/tokens/${token.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user, pushUserNotification]
  );

  // Staff: Update live crowd level, crowd %, waiting count, pause state, delay, or counters
  const updateStaffLocationState = useCallback(
    async (
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
    ) => {
      if (!user) return;
      setBusyAction('staff_update');
      try {
        const payload: Record<string, unknown> = {
          ...updates,
          dataSource: 'live_provider',
          updatedAt: serverTimestamp(),
        };
        if (typeof updates.crowdPercentage === 'number' && !updates.crowdLevel) {
          payload.crowdLevel = computeCrowdLevel(loc.waitingCount ?? 0, updates.crowdPercentage);
        }
        await updateDoc(doc(db, 'locations', loc.id), payload);

        if (
          (typeof updates.delayMinutes === 'number' && updates.delayMinutes > loc.delayMinutes) ||
          (typeof updates.isPaused === 'boolean' && updates.isPaused !== loc.isPaused)
        ) {
          const waitingHolders = staffAllTokens.filter((t) => t.status === 'waiting');
          const uniqueUids = Array.from(new Set(waitingHolders.map((t) => t.userId)));
          const title =
            typeof updates.isPaused === 'boolean'
              ? updates.isPaused
                ? `Queue Paused at ${loc.name}`
                : `Queue Resumed at ${loc.name}`
              : `Delay Update at ${loc.name}`;
          const message =
            typeof updates.isPaused === 'boolean'
              ? updates.isPaused
                ? 'New bookings are temporarily paused by the counter.'
                : 'Queue booking has resumed.'
              : `Estimated wait adjusted (+${updates.delayMinutes} min total delay).`;
          await Promise.all(
            uniqueUids.slice(0, 15).map((uid) =>
              pushUserNotification(uid, loc.id, 'delay', title, message)
            )
          );
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `locations/${loc.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user, staffAllTokens, pushUserNotification]
  );

  // Staff: QR Code Check-In -> immediately updates token status to 'in_progress'
  const checkInTokenByQr = useCallback(
    async (
      loc: ServiceLocation,
      rawQrOrCode: string,
      counterName: string
    ): Promise<{ token: QueueToken; alreadyInProgress: boolean }> => {
      if (!user) throw new Error('Sign in required');
      const parsed = parseTokenQrPayload(rawQrOrCode);
      if (!parsed) {
        throw new Error('Invalid QR code or token code format.');
      }
      if (parsed.locationId && parsed.locationId !== loc.id) {
        throw new Error('This QR code belongs to a different service location.');
      }

      const matched = staffAllTokens.find((t) => {
        if (parsed.tokenId && t.id === parsed.tokenId) return true;
        if (
          parsed.tokenCode &&
          t.tokenCode.toUpperCase() === parsed.tokenCode.toUpperCase() &&
          (t.status === 'waiting' || t.status === 'serving' || t.status === 'in_progress')
        ) {
          return true;
        }
        return false;
      });

      if (!matched) {
        throw new Error(
          `No matching active token found at ${loc.name} for "${parsed.tokenCode || parsed.tokenId}".`
        );
      }

      if (matched.status === 'completed' || matched.status === 'skipped' || matched.status === 'cancelled') {
        throw new Error(`Token ${matched.tokenCode} is already ${matched.status}.`);
      }

      if (matched.status === 'in_progress') {
        return { token: matched, alreadyInProgress: true };
      }

      setBusyAction('staff_checkin');
      const assignedCounter = sanitizeString(
        counterName || loc.counters[0] || 'Counter 1',
        BLUEPRINT_LIMITS.COUNTER_NAME_MAX
      );

      try {
        const locRef = doc(db, 'locations', loc.id);
        const tokenRef = doc(db, 'locations', loc.id, 'tokens', matched.id);

        await runTransaction(db, async (tx) => {
          const [locSnap, tokSnap] = await Promise.all([tx.get(locRef), tx.get(tokenRef)]);
          if (!tokSnap.exists()) {
            throw new Error('Token record not found.');
          }
          const tokData = tokSnap.data();
          if (tokData.status !== 'waiting' && tokData.status !== 'serving') {
            throw new Error(`Token ${matched.tokenCode} is already ${tokData.status}.`);
          }

          tx.update(tokenRef, {
            status: 'in_progress',
            counterName: assignedCounter,
            updatedAt: serverTimestamp(),
          });

          if (locSnap.exists()) {
            const locData = locSnap.data();
            const curWait = Number(locData.waitingCount || 0);
            const nextWait = tokData.status === 'waiting' ? Math.max(0, curWait - 1) : curWait;
            const maxCap = Number(locData.maxCapacity || 35);
            const nextPct = computeCrowdPercentage(nextWait, maxCap);
            tx.update(locRef, {
              waitingCount: nextWait,
              crowdPercentage: nextPct,
              crowdLevel: computeCrowdLevel(nextWait, nextPct),
              currentlyServingNumber: matched.sequenceNumber,
              currentlyServingCode: matched.tokenCode,
              dataSource: 'live_provider',
              updatedAt: serverTimestamp(),
            });
          }
        });

        await pushUserNotification(
          matched.userId,
          loc.id,
          'your_turn',
          `Checked In — ${matched.tokenCode}`,
          `Your arrival at ${loc.name} is checked in. Status: In Progress at ${assignedCounter}.`,
          matched.id
        );

        return {
          token: {
            ...matched,
            status: 'in_progress',
            counterName: assignedCounter,
            updatedAtMs: Date.now(),
          },
          alreadyInProgress: false,
        };
      } catch (err) {
        if (err instanceof Error && err.message.includes('Token')) throw err;
        handleFirestoreError(err, OperationType.UPDATE, `locations/${loc.id}/tokens/${matched.id}`);
      } finally {
        setBusyAction(null);
      }
    },
    [user, staffAllTokens, pushUserNotification]
  );

  return {
    user,
    authReady,
    profile,
    locations,
    managedLocations,
    activeStaffLocation,
    setStaffLocationId,
    userTokens,
    activeUserToken,
    locationActiveTokens,
    staffAllTokens,
    notifications,
    unreadNotificationCount: notifications.filter((n) => !n.read).length,
    busyAction,
    authError,
    isAdminUser,
    selectedLocationId,
    setSelectedLocationId,
    signInWithGoogle,
    signOutUser,
    updateProfileSettings,
    toggleFavoriteLocation,
    markAllNotificationsRead,
    bookToken,
    cancelToken,
    registerLocation,
    callNextToken,
    completeToken,
    skipToken,
    checkInTokenByQr,
    updateStaffLocationState,
  };
}
