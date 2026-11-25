import { CrowdLevel, GeneralBusyness, LanguageCode, PriorityTier, ServiceCategory, TokenStatus } from '../types/qlite';

export const LANGUAGES: { code: LanguageCode; name: string; nativeName: string }[] = [
  { code: 'en', name: 'English', nativeName: 'English' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ' },
];

export interface TranslationBundle {
  appName: string;
  tagline: string;
  getStarted: string;
  chooseLanguage: string;
  languageSubtitle: string;
  continueBtn: string;
  nav: {
    home: string;
    explore: string;
    liveQueue: string;
    history: string;
    profile: string;
    staff: string;
    alerts: string;
    reports: string;
  };
  auth: {
    title: string;
    subtitle: string;
    googleSignIn: string;
    mobileLabel: string;
    mobilePlaceholder: string;
    nameLabel: string;
    namePlaceholder: string;
    otpNote: string;
    sendOtpDemo: string;
    verifyAndContinue: string;
    signOut: string;
    signedInAs: string;
    guestModeNote: string;
    completeProfile: string;
  };
  home: {
    greetingMorning: string;
    greetingAfternoon: string;
    greetingEvening: string;
    whereToGo: string;
    searchPlaceholder: string;
    detectGps: string;
    refreshLocation: string;
    gpsActive: string;
    gpsFallback: string;
    categoriesTitle: string;
    smartRecsTitle: string;
    liveHighlightsTitle: string;
    recentlyViewedTitle: string;
    lessCrowdedNow: string;
    bestTimeToday: string;
    nearbyPlaces: string;
    activeTokenBanner: string;
    viewLiveQueue: string;
    exploreNearby: string;
    viewDetails: string;
    allCategories: string;
    detectingPlaces: string;
    refreshNearby: string;
    openNow: string;
    closed: string;
    hoursUnavailable: string;
  };
  explore: {
    mapView: string;
    listView: string;
    splitView: string;
    radiusLabel: string;
  };
  crowd: Record<CrowdLevel, string> & { unavailable: string };
  busyness: Record<GeneralBusyness, string>;
  dataSource: {
    live_provider: string;
    google_places: string;
    unavailable: string;
    generalBusynessTitle: string;
    generalBusynessHint: string;
    gpsDisclaimer: string;
  };
  categories: Record<ServiceCategory, string>;
  place: {
    peopleWaiting: string;
    crowdPercentage: string;
    estWait: string;
    mins: string;
    hours: string;
    updated: string;
    counters: string;
    services: string;
    joinQueue: string;
    queuePaused: string;
    connectLiveQueue: string;
    liveDataUnavailable: string;
    liveRequiredNote: string;
    gpsCoordinates: string;
    otherBranches: string;
    bestTimeToVisit: string;
    travelEta: string;
    getDirections: string;
    priorityRulesTitle: string;
    priorityRulesBody: string;
    saveFavorite: string;
    savedFavorite: string;
    alreadyInQueue: string;
  };
  booking: {
    title: string;
    selectService: string;
    selectSlot: string;
    nowWalkIn: string;
    priorityTier: string;
    confirmBooking: string;
    duplicateWarning: string;
    lateWarning: string;
    estimatedServiceTime: string;
  };
  priority: Record<PriorityTier, { label: string; desc: string }>;
  token: {
    title: string;
    tokenNumber: string;
    placeName: string;
    service: string;
    bookedAt: string;
    estServiceTime: string;
    peopleAhead: string;
    currentlyServing: string;
    estWait: string;
    progress: string;
    cancelToken: string;
    confirmCancel: string;
    trackLive: string;
    yourTurnBanner: string;
    inProgressBanner: string;
    showQrAtCounter: string;
    approachingBanner: string;
    twoAheadBanner: string;
    fiveAheadBanner: string;
    noActiveToken: string;
    exploreNow: string;
  };
  status: Record<TokenStatus, string>;
  notifications: {
    title: string;
    markAllRead: string;
    empty: string;
  };
  history: {
    title: string;
    activeTab: string;
    pastTab: string;
    emptyActive: string;
    emptyPast: string;
    bookAgain: string;
    skipReasonLabel: string;
  };
  profile: {
    title: string;
    accountSection: string;
    languageSection: string;
    favoritesSection: string;
    notificationsSection: string;
    fiveAheadPref: string;
    turnReadyPref: string;
    delaysPref: string;
    browserPushPref: string;
    saveChanges: string;
    savedToast: string;
    staffPortalBtn: string;
    noFavorites: string;
  };
  staff: {
    title: string;
    registerLocation: string;
    selectLocation: string;
    crowdStatus: string;
    crowdPercentageLabel: string;
    pauseQueue: string;
    resumeQueue: string;
    pausedBadge: string;
    callNext: string;
    completeCurrent: string;
    skipWithReason: string;
    skipReasonPlaceholder: string;
    addDelay: string;
    activeTokens: string;
    waitingCount: string;
    countersTitle: string;
    addCounter: string;
    viewReports: string;
    unauthorizedNote: string;
    noManagedLocations: string;
    createFirstLocation: string;
    scanQrCheckIn: string;
    qrModalTitle: string;
    qrModalSubtitle: string;
    inProgressTitle: string;
  };
  reports: {
    title: string;
    totalIssued: string;
    completed: string;
    skipped: string;
    cancelled: string;
    avgWait: string;
    hourlyVolume: string;
    priorityBreakdown: string;
    categorySummary: string;
  };
}

const en: TranslationBundle = {
  appName: 'QLite',
  tagline: 'Skip the Wait, Save Your Time',
  getStarted: 'Get Started',
  chooseLanguage: 'Choose Your Language',
  languageSubtitle: 'Switch anytime without losing your active queue tokens.',
  continueBtn: 'Continue',
  nav: {
    home: 'Home',
    explore: 'Explore',
    liveQueue: 'Live Queue',
    history: 'History',
    profile: 'Profile',
    staff: 'Staff Desk',
    alerts: 'Alerts',
    reports: 'Reports',
  },
  auth: {
    title: 'Welcome to QLite',
    subtitle: 'Sign in to book digital tokens, track live queues, and receive turn alerts.',
    googleSignIn: 'Continue with Google',
    mobileLabel: 'Mobile Number (for queue alerts)',
    mobilePlaceholder: '+91 98765 43210',
    nameLabel: 'Full Name',
    namePlaceholder: 'Enter your name',
    otpNote: 'Native SMS OTP requires enabling Phone Auth in Firebase Console. Google Sign-In verifies your session instantly.',
    sendOtpDemo: 'Verify Mobile Format',
    verifyAndContinue: 'Save Profile & Continue',
    signOut: 'Sign Out',
    signedInAs: 'Signed in as',
    guestModeNote: 'Browsing as guest — sign in to book tokens or manage a counter.',
    completeProfile: 'Complete Your Profile',
  },
  home: {
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    whereToGo: 'Where do you want to go?',
    searchPlaceholder: 'Where do you want to go?',
    detectGps: 'Use GPS',
    refreshLocation: 'Refresh Location',
    gpsActive: 'GPS Active',
    gpsFallback: 'Default Area',
    categoriesTitle: 'Quick Service Categories',
    smartRecsTitle: 'Live Crowd Highlights',
    liveHighlightsTitle: 'Live Crowd Highlights',
    recentlyViewedTitle: 'Recently Viewed Places',
    lessCrowdedNow: 'Connected Live Queues',
    bestTimeToday: 'Fastest Service Now',
    nearbyPlaces: 'Nearby Popular Places',
    activeTokenBanner: 'Active Token',
    viewLiveQueue: 'Track Live',
    exploreNearby: 'Explore Nearby',
    viewDetails: 'View Details',
    allCategories: 'All',
    detectingPlaces: 'Detecting real nearby places...',
    refreshNearby: 'Refresh Nearby',
    openNow: 'Open Now',
    closed: 'Closed',
    hoursUnavailable: 'Hours N/A',
  },
  explore: {
    mapView: 'Map View',
    listView: 'List View',
    splitView: 'Split',
    radiusLabel: 'Radius',
  },
  crowd: {
    low: 'Low Crowd',
    moderate: 'Moderate Crowd',
    high: 'High Crowd',
    very_high: 'Very High Crowd',
    unavailable: 'Live Data Unavailable',
  },
  busyness: {
    quiet: 'Typically Quiet Now',
    moderate: 'Typically Moderate Pace',
    busy: 'Typically Busy Now',
  },
  dataSource: {
    live_provider: 'Verified Live Queue',
    google_places: 'Google Places',
    unavailable: 'Live Data Unavailable',
    generalBusynessTitle: 'General Place Busyness',
    generalBusynessHint: 'Typical venue pace for this hour — not a live service queue count.',
    gpsDisclaimer: 'Locations are dynamically fetched from Google Places around your GPS coordinates. Verified crowd %, queue length, and token booking appear only for connected live queue venues.',
  },
  categories: {
    temple: 'Temples',
    hospital: 'Hospitals',
    bank: 'Banks',
    mall: 'Malls',
    post_office: 'Post Offices',
    government: 'Govt Offices',
    retail: 'Retail',
    cinema: 'Cinemas',
    restaurant: 'Food & Dining',
    college: 'College',
    other: 'Other',
  },
  place: {
    peopleWaiting: 'Queue Length',
    crowdPercentage: 'Live Crowd %',
    estWait: 'Est. Wait',
    mins: 'min',
    hours: 'Hours',
    updated: 'Updated',
    counters: 'Service Counters',
    services: 'Available Services',
    joinQueue: 'Join Queue',
    queuePaused: 'Booking Paused by Provider',
    connectLiveQueue: 'Connect Live Queue',
    liveDataUnavailable: 'Live Queue Data Unavailable',
    liveRequiredNote: 'This venue has not connected an authorized queue counter to QLite yet. No fabricated crowd percentage or queue count is shown. Authorized staff can connect this place via Staff Desk to publish verified live queue updates and digital tokens.',
    gpsCoordinates: 'GPS Coordinates',
    otherBranches: 'Nearby Same-Category Venues',
    bestTimeToVisit: 'Venue Status Note',
    travelEta: 'Travel ETA',
    getDirections: 'Directions',
    priorityRulesTitle: 'Fair Priority Queue Policy',
    priorityRulesBody: 'Senior citizens (60+), persons with disabilities, and medical emergencies receive accelerated priority while interleaving standard tokens fairly.',
    saveFavorite: 'Save Place',
    savedFavorite: 'Saved',
    alreadyInQueue: 'View Active Token',
  },
  booking: {
    title: 'Book Digital Token',
    selectService: '1. Select Service',
    selectSlot: '2. Preferred Time Slot',
    nowWalkIn: 'Immediate Digital Queue (Now)',
    priorityTier: '3. Queue Category',
    confirmBooking: 'Generate Digital Token',
    duplicateWarning: 'You already hold an active token at this location.',
    lateWarning: 'Travel warning: Your estimated travel time exceeds the expected queue wait. Your token may be called before you arrive.',
    estimatedServiceTime: 'Est. Service Time',
  },
  priority: {
    standard: { label: 'Standard Queue', desc: 'Regular first-come digital queue' },
    senior: { label: 'Senior Citizen (60+)', desc: 'Priority counter access for seniors' },
    disability: { label: 'Person with Disability', desc: 'Dedicated accessible priority assistance' },
    medical: { label: 'Medical Emergency', desc: 'Immediate urgent clinical triage priority' },
  },
  token: {
    title: 'Digital Queue Pass',
    tokenNumber: 'Token Number',
    placeName: 'Service Location',
    service: 'Selected Service',
    bookedAt: 'Booked At',
    estServiceTime: 'Est. Service Time',
    peopleAhead: 'People Ahead',
    currentlyServing: 'Currently Serving',
    estWait: 'Estimated Wait',
    progress: 'Queue Progress',
    cancelToken: 'Cancel Token',
    confirmCancel: 'Confirm Cancel',
    trackLive: 'Open Live Queue',
    yourTurnBanner: 'It is your turn now! Please proceed to the counter.',
    inProgressBanner: 'Checked in at venue — your service is now In Progress.',
    showQrAtCounter: 'Show this QR code to staff upon arrival for instant check-in.',
    approachingBanner: 'Your token is next! Head directly to the service counter.',
    twoAheadBanner: 'Only 2 people are ahead of you. Please be ready near the counter.',
    fiveAheadBanner: '5 or fewer people are ahead of you.',
    noActiveToken: 'No active digital token right now.',
    exploreNow: 'Explore Nearby Places',
  },
  status: {
    waiting: 'Waiting',
    in_progress: 'In Progress',
    serving: 'Now Serving',
    completed: 'Completed',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
  },
  notifications: {
    title: 'Notifications & Alerts',
    markAllRead: 'Mark All Read',
    empty: 'No notifications yet. Join a live queue to receive milestone and turn alerts.',
  },
  history: {
    title: 'Booking History',
    activeTab: 'Active Tokens',
    pastTab: 'Past Bookings',
    emptyActive: 'You have no active tokens.',
    emptyPast: 'No completed or cancelled bookings yet.',
    bookAgain: 'Book Again',
    skipReasonLabel: 'Reason',
  },
  profile: {
    title: 'Profile & Settings',
    accountSection: 'Account Details',
    languageSection: 'App Language',
    favoritesSection: 'Saved Locations',
    notificationsSection: 'Smart Alert Preferences',
    fiveAheadPref: 'Alert at 5 people ahead',
    turnReadyPref: 'Alert at 2 ahead, next in line, and my turn',
    delaysPref: 'Notify on provider delays or pauses',
    browserPushPref: 'Enable push & background notifications',
    saveChanges: 'Save Preferences',
    savedToast: 'Preferences saved',
    staffPortalBtn: 'Open Staff / Provider Console',
    noFavorites: 'No saved locations yet. Tap Save on any venue.',
  },
  staff: {
    title: 'Staff Queue Console',
    registerLocation: 'Connect Real Place',
    selectLocation: 'Managed Location',
    crowdStatus: 'Live Crowd Level',
    crowdPercentageLabel: 'Live Crowd Percentage (%)',
    pauseQueue: 'Pause Booking',
    resumeQueue: 'Resume Booking',
    pausedBadge: 'Queue Paused',
    callNext: 'Call Next Token',
    completeCurrent: 'Mark Completed',
    skipWithReason: 'Skip Token',
    skipReasonPlaceholder: 'Reason (e.g., Visitor not present)',
    addDelay: 'Delay Adjustment',
    activeTokens: 'Active Queue Tokens',
    waitingCount: 'Waiting',
    countersTitle: 'Service Counters',
    addCounter: 'Add Counter',
    viewReports: 'Daily Reports',
    unauthorizedNote: 'Sign in and connect a real venue location to publish live crowd levels and manage queues.',
    noManagedLocations: 'You have not connected a real-world venue yet.',
    createFirstLocation: 'Connect a Nearby Place',
    scanQrCheckIn: 'Scan QR Check-In',
    qrModalTitle: 'Visitor QR Check-In Scanner',
    qrModalSubtitle: 'Scan a visitor digital token QR code or enter token code to mark status In Progress.',
    inProgressTitle: 'Checked In (In Progress)',
  },
  reports: {
    title: 'Daily Queue & Service Reports',
    totalIssued: 'Tokens Issued',
    completed: 'Served & Completed',
    skipped: 'Skipped',
    cancelled: 'Cancelled',
    avgWait: 'Avg. Wait Time',
    hourlyVolume: 'Queue Activity by Hour',
    priorityBreakdown: 'Priority Distribution',
    categorySummary: 'Connected Live Venues Overview',
  },
};

const ta: TranslationBundle = {
  ...en,
  tagline: 'வரிசையைத் தவிர்த்து நேரத்தைச் சேமிக்கவும்',
  getStarted: 'தொடங்கவும்',
  chooseLanguage: 'உங்கள் மொழியைத் தேர்ந்தெடுக்கவும்',
  languageSubtitle: 'உங்கள் டோக்கன் விவரங்களை இழக்காமல் எப்போது வேண்டுமானாலும் மாற்றலாம்.',
  continueBtn: 'தொடரவும்',
  nav: {
    home: 'முகப்பு',
    explore: 'வரைபடம்',
    liveQueue: 'நேரடி வரிசை',
    history: 'வரலாறு',
    profile: 'சுயவிவரம்',
    staff: 'பணியாளர்',
    alerts: 'அறிவிப்பு',
    reports: 'அறிக்கை',
  },
  auth: {
    ...en.auth,
    title: 'QLite-க்கு வரவேற்கிறோம்',
    googleSignIn: 'Google மூலம் தொடரவும்',
    mobileLabel: 'கைபேசி எண்',
    nameLabel: 'முழுப் பெயர்',
    verifyAndContinue: 'சேமித்து தொடரவும்',
    signOut: 'வெளியேறு',
  },
  home: {
    ...en.home,
    greetingMorning: 'காலை வணக்கம்',
    greetingAfternoon: 'மதிய வணக்கம்',
    greetingEvening: 'மாலை வணக்கம்',
    whereToGo: 'நீங்கள் எங்கு செல்ல விரும்புகிறீர்கள்?',
    searchPlaceholder: 'நீங்கள் எங்கு செல்ல விரும்புகிறீர்கள்?',
    detectGps: 'GPS பயன்படுத்து',
    refreshLocation: 'இடத்தைப் புதுப்பிக்கவும்',
    gpsActive: 'GPS இணைக்கப்பட்டது',
    categoriesTitle: 'சேவை வகைகள்',
    smartRecsTitle: 'நேரடி கூட்ட விவரங்கள்',
    liveHighlightsTitle: 'நேரடி கூட்ட விவரங்கள்',
    recentlyViewedTitle: 'சமீபத்தில் பார்த்த இடங்கள்',
    lessCrowdedNow: 'நேரடி இணைக்கப்பட்ட இடங்கள்',
    nearbyPlaces: 'அருகிலுள்ள பிரபல இடங்கள்',
    exploreNearby: 'அருகிலுள்ளவற்றை ஆராய்க',
    viewDetails: 'விவரம் காண்க',
    allCategories: 'அனைத்தும்',
    detectingPlaces: 'Google Places மூலம் அருகிலுள்ள இடங்கள் கண்டறியப்படுகின்றன...',
    openNow: 'இப்போது திறந்துள்ளது',
    closed: 'மூடப்பட்டுள்ளது',
  },
  explore: {
    mapView: 'வரைபடக் காட்சி',
    listView: 'பட்டியல் காட்சி',
    splitView: 'இரு காட்சி',
    radiusLabel: 'தூரம்',
  },
  crowd: {
    low: 'குறைந்த கூட்டம்',
    moderate: 'மிதமான கூட்டம்',
    high: 'அதிக கூட்டம்',
    very_high: 'மிக அதிக கூட்டம்',
    unavailable: 'நேரடி தரவு இல்லை',
  },
  busyness: {
    quiet: 'பொதுவாக அமைதியான நேரம்',
    moderate: 'பொதுவாக மிதமான கூட்டம்',
    busy: 'பொதுவாக பரபரப்பான நேரம்',
  },
  dataSource: {
    ...en.dataSource,
    live_provider: 'சரிபார்க்கப்பட்ட நேரடி வரிசை',
    google_places: 'Google Places',
    unavailable: 'நேரடி தரவு இல்லை',
  },
  categories: {
    temple: 'கோயில்கள்',
    hospital: 'மருத்துவமனைகள்',
    bank: 'வங்கிகள்',
    mall: 'மால்கள்',
    post_office: 'அஞ்சல் நிலையம்',
    government: 'அரசு அலுவலகம்',
    retail: 'கடைகள்',
    cinema: 'திரையரங்கு',
    restaurant: 'உணவகம்',
    college: 'கல்லூரி',
    other: 'மற்றவை',
  },
  place: {
    ...en.place,
    peopleWaiting: 'காத்திருப்போர்',
    crowdPercentage: 'நேரடி கூட்ட அளவு %',
    estWait: 'காத்திருப்பு நேரம்',
    mins: 'நிமிடம்',
    joinQueue: 'வரிசையில் சேரவும்',
    queuePaused: 'முன்பதிவு தற்காலிகமாக நிறுத்தப்பட்டுள்ளது',
    liveDataUnavailable: 'நேரடி வரிசை தரவு இல்லை',
    connectLiveQueue: 'நேரடி வரிசையை இணைக்கவும்',
    getDirections: 'வழிகாட்டுதல்',
    saveFavorite: 'சேமி',
    savedFavorite: 'சேமிக்கப்பட்டது',
  },
  booking: {
    ...en.booking,
    title: 'டிஜிட்டல் டோக்கன் பதிவு',
    selectService: '1. சேவையைத் தேர்வு செய்க',
    selectSlot: '2. நேரத்தைத் தேர்வு செய்க',
    priorityTier: '3. முன்னுரிமை வகை',
    confirmBooking: 'டோக்கன் உருவாக்கு',
  },
  token: {
    ...en.token,
    title: 'டிஜிட்டல் டோக்கன்',
    tokenNumber: 'டோக்கன் எண்',
    peopleAhead: 'முன்னால் உள்ளவர்கள்',
    currentlyServing: 'தற்போதைய டோக்கன்',
    estWait: 'காத்திருப்பு நேரம்',
    cancelToken: 'ரத்து செய்',
    yourTurnBanner: 'இப்போது உங்கள் முறை! கவுண்டருக்குச் செல்லவும்.',
    inProgressBanner: 'வருகை பதிவு செய்யப்பட்டது — உங்கள் சேவை செயல்பாட்டில் உள்ளது.',
    approachingBanner: 'அடுத்து உங்கள் டோக்கன்! கவுண்டர் அருகே செல்லவும்.',
    twoAheadBanner: 'உங்களுக்கு முன்னால் 2 பேர் மட்டுமே உள்ளனர்.',
  },
  status: {
    ...en.status,
    in_progress: 'செயல்பாட்டில் (In Progress)',
  },
  staff: {
    ...en.staff,
    title: 'பணியாளர் கட்டுப்பாட்டு பலகை',
    callNext: 'அடுத்த டோக்கன்',
    completeCurrent: 'முடிந்தது',
    skipWithReason: 'தவிர்க்கவும்',
    pauseQueue: 'நிறுத்து',
    resumeQueue: 'தொடங்கு',
    scanQrCheckIn: 'QR ஸ்கேன் பதிவு',
  },
};

const hi: TranslationBundle = {
  ...en,
  tagline: 'कतार से बचें, अपना समय बचाएं',
  getStarted: 'शुरू करें',
  chooseLanguage: 'अपनी भाषा चुनें',
  languageSubtitle: 'अपना टोकन खोए बिना कभी भी भाषा बदलें।',
  continueBtn: 'आगे बढ़ें',
  nav: {
    home: 'होम',
    explore: 'नक्शा',
    liveQueue: 'लाइव कतार',
    history: 'इतिहास',
    profile: 'प्रोफ़ाइल',
    staff: 'स्टाफ डेस्क',
    alerts: 'अलर्ट',
    reports: 'रिपोर्ट',
  },
  auth: {
    ...en.auth,
    title: 'QLite में आपका स्वागत है',
    googleSignIn: 'Google से साइन इन करें',
    mobileLabel: 'मोबाइल नंबर',
    nameLabel: 'पूरा नाम',
    verifyAndContinue: 'सहेजें और आगे बढ़ें',
    signOut: 'साइन आउट',
  },
  home: {
    ...en.home,
    greetingMorning: 'सुप्रभात',
    greetingAfternoon: 'नमस्कार',
    greetingEvening: 'शुभ संध्या',
    whereToGo: 'आप कहाँ जाना चाहते हैं?',
    searchPlaceholder: 'आप कहाँ जाना चाहते हैं?',
    detectGps: 'GPS उपयोग करें',
    refreshLocation: 'लोकेशन रीफ्रेश करें',
    gpsActive: 'GPS सक्रिय',
    categoriesTitle: 'त्वरित सेवा श्रेणियाँ',
    smartRecsTitle: 'लाइव भीड़ हाइलाइट्स',
    liveHighlightsTitle: 'लाइव भीड़ हाइलाइट्स',
    recentlyViewedTitle: 'हाल ही में देखे गए स्थान',
    lessCrowdedNow: 'लाइव जुड़े स्थान',
    nearbyPlaces: 'आस-पास के लोकप्रिय स्थान',
    exploreNearby: 'आस-पास खोजें',
    viewDetails: 'विवरण देखें',
    allCategories: 'सभी',
    detectingPlaces: 'आस-पास के वास्तविक स्थान खोजे जा रहे हैं...',
    openNow: 'अभी खुला है',
    closed: 'बंद है',
  },
  explore: {
    mapView: 'मानचित्र दृश्य',
    listView: 'सूची दृश्य',
    splitView: 'विभाजित',
    radiusLabel: 'दायरा',
  },
  crowd: {
    low: 'कम भीड़',
    moderate: 'मध्यम भीड़',
    high: 'अधिक भीड़',
    very_high: 'बहुत अधिक भीड़',
    unavailable: 'लाइव डेटा उपलब्ध नहीं',
  },
  busyness: {
    quiet: 'सामान्यतः शांत समय',
    moderate: 'सामान्यतः मध्यम भीड़',
    busy: 'सामान्यतः व्यस्त समय',
  },
  dataSource: {
    ...en.dataSource,
    live_provider: 'सत्यापित लाइव कतार',
    google_places: 'Google Places',
    unavailable: 'लाइव डेटा उपलब्ध नहीं',
  },
  categories: {
    temple: 'मंदिर',
    hospital: 'अस्पताल',
    bank: 'बैंक',
    mall: 'मॉल',
    post_office: 'डाकघर',
    government: 'सरकारी दफ्तर',
    retail: 'दुकानें',
    cinema: 'सिनेमा',
    restaurant: 'रेस्तरां',
    college: 'कॉलेज',
    other: 'अन्य',
  },
  place: {
    ...en.place,
    peopleWaiting: 'कतार की लंबाई',
    crowdPercentage: 'लाइव भीड़ %',
    estWait: 'अनुमानित समय',
    mins: 'मिनट',
    joinQueue: 'कतार में जुड़ें',
    queuePaused: 'बुकिंग अस्थायी रूप से रुकी है',
    liveDataUnavailable: 'लाइव डेटा उपलब्ध नहीं है',
    connectLiveQueue: 'लाइव कतार जोड़ें',
    getDirections: 'दिशा-निर्देश',
    saveFavorite: 'सहेजें',
    savedFavorite: 'सहेजा गया',
  },
  booking: {
    ...en.booking,
    title: 'डिजिटल टोकन बुक करें',
    selectService: '1. सेवा चुनें',
    selectSlot: '2. समय स्लॉट चुनें',
    priorityTier: '3. प्राथमिकता श्रेणी',
    confirmBooking: 'टोकन प्राप्त करें',
  },
  token: {
    ...en.token,
    title: 'डिजिटल कतार पास',
    tokenNumber: 'टोकन नंबर',
    peopleAhead: 'आगे लोग',
    currentlyServing: 'वर्तमान टोकन',
    estWait: 'अनुमानित प्रतीक्षा',
    cancelToken: 'टोकन रद्द करें',
    yourTurnBanner: 'अब आपकी बारी है! कृपया काउंटर पर जाएं।',
    inProgressBanner: 'चेक-इन पूर्ण — आपकी सेवा अब प्रगति पर है।',
    approachingBanner: 'अगला टोकन आपका है! कृपया काउंटर के पास पहुंचें।',
    twoAheadBanner: 'आपसे पहले केवल 2 लोग हैं। कृपया तैयार रहें।',
  },
  status: {
    ...en.status,
    in_progress: 'प्रगति पर (In Progress)',
  },
  staff: {
    ...en.staff,
    title: 'स्टाफ कतार प्रबंधन',
    callNext: 'अगला टोकन बुलाएं',
    completeCurrent: 'सेवा पूर्ण',
    skipWithReason: 'स्किप करें',
    pauseQueue: 'कतार रोकें',
    resumeQueue: 'कतार शुरू करें',
    scanQrCheckIn: 'QR स्कैन चेक-इन',
  },
};

const te: TranslationBundle = {
  ...en,
  tagline: 'క్యూను తప్పించుకోండి, మీ సమయాన్ని ఆదా చేయండి',
  getStarted: 'ప్రారంభించండి',
  chooseLanguage: 'మీ భాషను ఎంచుకోండి',
  continueBtn: 'కొనసాగండి',
  nav: {
    home: 'హోమ్',
    explore: 'మ్యాప్',
    liveQueue: 'లైవ్ క్యూ',
    history: 'చరిత్ర',
    profile: 'ప్రొఫైల్',
    staff: 'సిబ్బంది',
    alerts: 'హెచ్చరికలు',
    reports: 'నివేదికలు',
  },
  home: {
    ...en.home,
    whereToGo: 'మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?',
    searchPlaceholder: 'మీరు ఎక్కడికి వెళ్లాలనుకుంటున్నారు?',
    exploreNearby: 'సమీపంలోనివి చూడండి',
    recentlyViewedTitle: 'ఇటీవల చూసిన ప్రదేశాలు',
    openNow: 'తెరిచి ఉంది',
    closed: 'మూసి ఉంది',
  },
  crowd: {
    low: 'తక్కువ రద్దీ',
    moderate: 'మధ్యస్థ రద్దీ',
    high: 'ఎక్కువ రద్దీ',
    very_high: 'చాలా ఎక్కువ రద్దీ',
    unavailable: 'లైవ్ డేటా లేదు',
  },
  dataSource: {
    ...en.dataSource,
    live_provider: 'ధృవీకరించిన లైవ్ క్యూ',
    unavailable: 'లైవ్ డేటా లేదు',
  },
  place: {
    ...en.place,
    peopleWaiting: 'వేచి ఉన్నవారు',
    crowdPercentage: 'రద్దీ శాతం',
    estWait: 'అంచనా సమయం',
    mins: 'నిమి',
    joinQueue: 'క్యూలో చేరండి',
    liveDataUnavailable: 'లైవ్ డేటా అందుబాటులో లేదు',
  },
  token: {
    ...en.token,
    tokenNumber: 'టోకెన్ నంబర్',
    peopleAhead: 'ముందున్న వారు',
    currentlyServing: 'ప్రస్తుత టోకెన్',
    cancelToken: 'రద్దు చేయండి',
    yourTurnBanner: 'ఇప్పుడు మీ వంతు! కౌంటర్ వద్దకు వెళ్లండి.',
  },
};

const ml: TranslationBundle = {
  ...en,
  tagline: 'ക്യൂ ഒഴിവാക്കൂ, സമയം ലാഭിക്കൂ',
  getStarted: 'തുടങ്ങുക',
  chooseLanguage: 'ഭാഷ തിരഞ്ഞെടുക്കുക',
  continueBtn: 'തുടരുക',
  nav: {
    home: 'ഹോം',
    explore: 'മാപ്പ്',
    liveQueue: 'ലൈവ് ക്യൂ',
    history: 'ചരിത്രം',
    profile: 'പ്രൊഫൈൽ',
    staff: 'സ്റ്റാഫ്',
    alerts: 'അറിയിപ്പുകൾ',
    reports: 'റിപ്പോർട്ടുകൾ',
  },
  home: {
    ...en.home,
    whereToGo: 'നിങ്ങൾക്ക് എവിടെ പോകണം?',
    searchPlaceholder: 'നിങ്ങൾക്ക് എവിടെ പോകണം?',
    exploreNearby: 'സമീപത്തുള്ളവ കാണുക',
    recentlyViewedTitle: 'അടുത്തിടെ കണ്ട സ്ഥലങ്ങൾ',
    openNow: 'ഇപ്പോൾ തുറന്നിരിക്കുന്നു',
    closed: 'അടച്ചിരിക്കുന്നു',
  },
  crowd: {
    low: 'കുറഞ്ഞ തിരക്ക്',
    moderate: 'മിതമായ തിരക്ക്',
    high: 'കൂടിയ തിരക്ക്',
    very_high: 'അതിശക്തമായ തിരക്ക്',
    unavailable: 'ലൈവ് ഡാറ്റ ലഭ്യമല്ല',
  },
  dataSource: {
    ...en.dataSource,
    live_provider: 'സ്ഥിരീകരിച്ച ലൈവ് ക്യൂ',
    unavailable: 'ലൈവ് ഡാറ്റ ലഭ്യമല്ല',
  },
  place: {
    ...en.place,
    peopleWaiting: 'കാത്തിരിക്കുന്നവർ',
    crowdPercentage: 'തിരക്ക് ശതമാനം',
    estWait: 'ഏകദേശ സമയം',
    mins: 'മിനിറ്റ്',
    joinQueue: 'ക്യൂവിൽ ചേരുക',
    liveDataUnavailable: 'ലൈവ് ഡാറ്റ ലഭ്യമല്ല',
  },
  token: {
    ...en.token,
    tokenNumber: 'ടോക്കൺ നമ്പർ',
    peopleAhead: 'മുന്നിലുള്ളവർ',
    currentlyServing: 'നിലവിലെ ടോക്കൺ',
    cancelToken: 'റദ്ദാക്കുക',
    yourTurnBanner: 'ഇപ്പോൾ നിങ്ങളുടെ ഊഴമാണ്! കൗണ്ടറിലേക്ക് ചെല്ലുക.',
  },
};

const kn: TranslationBundle = {
  ...en,
  tagline: 'ಸರತಿ ತಪ್ಪಿಸಿ, ನಿಮ್ಮ ಸಮಯ ಉಳಿಸಿ',
  getStarted: 'ಪ್ರಾರಂಭಿಸಿ',
  chooseLanguage: 'ನಿಮ್ಮ ಭಾಷೆಯನ್ನು ಆಯ್ಕೆಮಾಡಿ',
  continueBtn: 'ಮುಂದುವರಿಸಿ',
  nav: {
    home: 'ಮುಖಪುಟ',
    explore: 'ನಕ್ಷೆ',
    liveQueue: 'ಲೈವ್ ಕ್ಯೂ',
    history: 'ಇತಿಹಾಸ',
    profile: 'ಪ್ರೊಫೈಲ್',
    staff: 'ಸಿಬ್ಬಂದಿ',
    alerts: 'ಸೂಚನೆಗಳು',
    reports: 'ವರದಿಗಳು',
  },
  home: {
    ...en.home,
    whereToGo: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಲು ಬಯಸುತ್ತೀರಿ?',
    searchPlaceholder: 'ನೀವು ಎಲ್ಲಿಗೆ ಹೋಗಲು ಬಯಸುತ್ತೀರಿ?',
    exploreNearby: 'ಸುತ್ತಮುತ್ತಲಿನ ಸ್ಥಳಗಳನ್ನು ನೋಡಿ',
    recentlyViewedTitle: 'ಇತ್ತೀಚೆಗೆ ನೋಡಿದ ಸ್ಥಳಗಳು',
    openNow: 'ಈಗ ತೆರೆದಿದೆ',
    closed: 'ಮುಚ್ಚಲಾಗಿದೆ',
  },
  crowd: {
    low: 'ಕಡಿಮೆ ಜನದಟ್ಟಣೆ',
    moderate: 'ಮಧ್ಯಮ ಜನದಟ್ಟಣೆ',
    high: 'ಹೆಚ್ಚು ಜನದಟ್ಟಣೆ',
    very_high: 'ಅತಿ ಹೆಚ್ಚು ಜನದಟ್ಟಣೆ',
    unavailable: 'ಲೈವ್ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ',
  },
  dataSource: {
    ...en.dataSource,
    live_provider: 'ಪರಿಶೀಲಿತ ಲೈವ್ ಕ್ಯೂ',
    unavailable: 'ಲೈವ್ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ',
  },
  place: {
    ...en.place,
    peopleWaiting: 'ಕಾಯುತ್ತಿರುವವರು',
    crowdPercentage: 'ಜನದಟ್ಟಣೆ %',
    estWait: 'ಅಂದಾಜು ಸಮಯ',
    mins: 'ನಿಮಿಷ',
    joinQueue: 'ಸರತಿ ಸೇರಿ',
    liveDataUnavailable: 'ಲೈವ್ ಡೇಟಾ ಲಭ್ಯವಿಲ್ಲ',
  },
  token: {
    ...en.token,
    tokenNumber: 'ಟೋಕನ್ ಸಂಖ್ಯೆ',
    peopleAhead: 'ಮುಂದೆ ಇರುವವರು',
    currentlyServing: 'ಪ್ರಸ್ತುತ ಟೋಕನ್',
    cancelToken: 'ರದ್ದುಮಾಡಿ',
    yourTurnBanner: 'ಈಗ ನಿಮ್ಮ ಸರತಿ! ದಯವಿಟ್ಟು ಕೌಂಟರ್‌ಗೆ ಬನ್ನಿ.',
  },
};

const BUNDLES: Record<LanguageCode, TranslationBundle> = { en, ta, hi, te, ml, kn };

export function getTranslations(lang: LanguageCode): TranslationBundle {
  return BUNDLES[lang] || en;
}
