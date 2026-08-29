// Single source of Hebrew copy. NO hardcoded UI strings in components — the
// founder rewrites the voice here without touching code (spec section 14).

import type {
  BackStyle,
  Condition,
  Fabric,
  FitVerdict,
  HandoffMethod,
  Length,
  Neckline,
  PaymentMethod,
  PurchaseRequestState,
  Size,
  Sleeve,
  TxState,
} from "@/lib/types";

export const he = {
  appName: "ארון",
  tagline: "שמלות ערב יד שנייה — לפי הגוף שלך",

  nav: {
    feed: "פיד",
    search: "חיפוש",
    sell: "מכירה",
    deals: "עסקאות",
    profile: "פרופיל",
    admin: "ניהול",
  },

  feed: {
    explainer: "הפיד שלך מסונן לפי נשים בגובה ובמידה שלך",
    showAllSizes: "כל המידות",
    matchedOnly: "לפי המידה שלי",
    empty: "אין עדיין שמלות. חזרי בקרוב.",
    occasionFilter: "אירוע",
    allOccasions: "כל האירועים",
  },

  onboarding: {
    sheetTitle: "רוצה לדעת אם זה יתאים לך?",
    sheetSub: "שני פרטים, ואנחנו מסדרים לך את כל הפיד לפי הגוף שלך.",
    height: "גובה",
    heightUnit: 'ס"מ',
    usualSize: "מידה רגילה",
    continue: "המשך",
    phoneTitle: "אימות טלפון",
    phoneLabel: "מספר טלפון",
    phonePlaceholder: "05X-XXXXXXX",
    sendCode: "שליחת קוד",
    codeLabel: "הקוד שקיבלת",
    verify: "אימות",
    codeHintSms: "שלחנו לך קוד ב-SMS.",
    codeHintDev: "מצב פיתוח: הקוד מודפס בקונסולת השרת.",
    email: {
      row: "אימייל לכניסה",
      hint: "הוסיפי אימייל כדי להתחבר בלי SMS בפעם הבאה.",
      label: "כתובת אימייל",
      placeholder: "you@example.com",
      sendCode: "שליחת קוד למייל",
      codeSent: "שלחנו קוד לכתובת הזו.",
      verified: "אימייל מאומת:",
      change: "שינוי",
      remove: "הסרה",
      saved: "האימייל נשמר. אפשר להתחבר איתו מעכשיו.",
    },
    done: "מעולה! הפיד שלך מסודר עכשיו לפי הגוף שלך.",
    enrichLater:
      "אפשר להוסיף אחר כך תמונה, מבנה גוף ומידת חזייה — זה משפר את ההתאמות.",
  },

  match: {
    tierA: "מידה כמו שלך",
    tierB: "קרוב למידה שלך",
    tierC: "כל השמלות",
    needBodyCard: "מלאי גובה ומידה כדי לראות התאמות",
    ownerVsYou: "היא לעומתך",
    yourHeight: "הגובה שלך",
    yourSize: "המידה שלך",
    ownerVerdictPrefix: "המוכרת אומרת",
  },

  item: {
    buy: "אני רוצה את זה",
    buySub: "התשלום מתבצע ישירות מולה בביט, בדרך כלל בזמן המסירה.",
    price: "מחיר",
    originalPrice: "מחיר מקורי",
    brand: "מותג",
    size: "מידה",
    labelSize: "מידה על התווית",
    color: "צבע",
    length: "אורך",
    neckline: "מחשוף",
    sleeve: "שרוול",
    back: "גב",
    fabric: "סוג בד",
    condition: "מצב",
    occasions: "אירועים",
    description: "תיאור",
    viewCloset: "צפי בארון שלה",
    follow: "עקבי",
    following: "עוקבת",
    sales: "מכירות",
    rating: "דירוג",
    noRating: "אין דירוג עדיין",
    report: "דיווח",
    returnPolicyInline:
      "48 שעות להחזרה מרגע המסירה — ההחזר מתבצע ישירות בין שתי הצדדות.",
    acceptsPayment: "מקבלת תשלום ב",
    sold: "נמכר",
    reserved: "בהמתנה",
    pendingRequest: "יש בקשה פעילה",
    requestSent: "הבקשה נשלחה — נעדכן אותך כשהמוכרת תענה",
    likes: "לייקים",
    edit: "עריכה",
    hide: "הסתרה",
    unhide: "הצגה מחדש",
    publishNow: "פרסום",
    markSold: "נמכר",
  },

  request: {
    sheetTitle: (name: string) => `לשלוח בקשה ל${name}?`,
    sheetBody:
      "היא תקבל הודעה שאת מעוניינת. רק אחרי שהיא מאשרת תקבלו את מספרי הטלפון אחת של השנייה.",
    messagePlaceholder: "אפשר להוסיף הודעה קצרה…",
    send: "שליחת בקשה",
    inboxTitle: "בקשות קנייה",
    wants: (name: string) => `${name} רוצה את השמלה שלך`,
    approve: "מאשרת",
    decline: "לא עכשיו",
    block: "חסימת המשתמשת",
    expiresIn: (h: number) => `הבקשה תפוג בעוד ${h} שעות`,
    approved: "אושרה",
    declined: "לא זמינה",
    expired: "פגה",
    none: "אין בקשות",
    revealNote:
      "מספר הטלפון שלך נחשף לצד השני כדי שתוכלו לתאם. זה קורה רק אחרי אישור.",
  },

  sellOff: {
    title: "מה קרה עם השמלה?",
    onPlatform: "נמכרה דרך האתר",
    offPlatform: "נמכרה במקום אחר",
    notRelevant: "כבר לא רלוונטי",
    channelQ: "איפה נמכרה?",
    channels: {
      facebook: "פייסבוק",
      whatsapp: "וואטסאפ",
      instagram: "אינסטגרם",
      in_person: "פנים אל פנים",
      other: "אחר",
    },
    priceQ: "באיזה מחיר? (₪)",
    submit: "עדכון",
    done: "תודה, עודכן",
  },

  closet: {
    myCloset: "הארון שלי",
    uploadDress: "+ העלאת שמלה",
    drafts: "טיוטות",
    hidden: "מוסתר",
    available: "למכירה",
    soldItems: "נמכרו",
    city: "עיר",
    bodyCard: "כרטיס גוף",
    height: "גובה",
    shape: "מבנה גוף",
    trust: "אמון",
    editBodyCard: "עריכת כרטיס גוף",
    noItems: "אין פריטים עדיין",
  },

  sell: {
    title: "העלאת שמלה",
    step_photos: "תמונות",
    step_details: "פרטים",
    step_size: "מידה ופדבק",
    step_price: "מחיר",
    addPhoto: "הוספת תמונה",
    onBodyPrompt:
      "צריך לפחות תמונה אחת עם השמלה לבושה. אפשר לחתוך או להסתיר את הפנים.",
    onBodyToggle: "תמונה על הגוף",
    aiFilling: "ממלאים אוטומטית מהתמונה…",
    aiFailed: "לא הצלחנו למלא אוטומטית — אפשר למלא ידנית.",
    aiHint: "עברי על מה שמולא אוטומטית ותקני מה שצריך.",
    titleField: "כותרת",
    ownerVerdictQ: "איך יצא לך?",
    comparablePrices: (n: number) => `${n} שמלות דומות נמכרו בטווח הזה`,
    noComparables: "אין עדיין נתוני מחיר להשוואה",
    publish: "פרסום",
    saveDraft: "שמירת טיוטה",
    needOnBody: "צריך לפחות תמונה אחת עם השמלה לבושה כדי לפרסם",
    published: "השמלה פורסמה 🎉",
    editTitle: "עריכת שמלה",
    saveChanges: "שמירת שינויים",
    saved: "השינויים נשמרו",
    lockedInDeal: "אי אפשר לערוך שמלה שנמצאת בעסקה פעילה",
  },

  deals: {
    bought: "קניתי",
    sold: "מכרתי",
    requests: "בקשות",
    none: "אין עסקאות עדיין",
    state: "מצב",
    returnCountdown: "זמן שנותר להחזרה",
    countdownDone: "חלון ההחזרה נסגר",
    matched: "מתואמות!",
    payment: "התשלום",
    amount: "סכום",
    toBit: "לביט",
    inNote: "בהערה",
    copy: "העתקה",
    copied: "הועתק",
    openWhatsapp: "פתיחת וואטסאפ",
    payOnHandoff: "מומלץ לשלם בזמן המסירה, אחרי שראית את השמלה.",
    heldForYou: (h: number) => `השמלה שמורה לך ל-${h} שעות`,
    handoffQ: "איך נפגשות?",
    pickup: "איסוף עצמי",
    shipping: "משלוח",
    prepayWarn:
      "שמלה יקרה שנשלחת לזרה — מומלץ להיפגש. בפיילוט אין הגנת תשלום.",
    waitingSeller: "ממתינות לאישור המוכרת",
    waitingBuyer: "ממתינות שהקונה תשלם",
    mismatchFlagged: "סומן לבדיקה של הצוות",
    actions: {
      markPaid: "שילמתי",
      confirmPaid: "קיבלתי תשלום",
      keep: "מתאים לי",
      startReturn: "מחזירה",
      sellerConfirmReturn: "אישור קבלת החזרה",
      cancel: "ביטול",
      rate: "דירוג",
    },
  },

  search: {
    title: "חיפוש",
    queryPlaceholder: "חיפוש לפי כותרת, מותג, תיאור…",
    occasion: "אירוע",
    size: "מידה",
    length: "אורך",
    color: "צבע",
    priceRange: "טווח מחיר",
    condition: "מצב",
    minPrice: "ממחיר",
    maxPrice: "עד מחיר",
    apply: "החל",
    clear: "ניקוי",
    results: (n: number) => `${n} תוצאות`,
    noResults: "לא נמצאו שמלות. נסי לרחיב את הסינון.",
  },

  admin: {
    title: "חדר הבקרה",
    kpi: "מדדים",
    transactions: "עסקאות",
    requests: "בקשות קנייה",
    disputes: "מחלוקות",
    flagged: "דורש טיפול",
    items: "פריטים",
    users: "משתמשות",
    reports: "דיווחים",
    events: "יומן אירועים",
    hide: "הסתרה",
    unhide: "ביטול הסתרה",
    suspend: "השעיה",
    unsuspend: "ביטול השעיה",
    forceComplete: "סגור כהושלם",
    forceCancel: "בטל עסקה",
    resolveReturn: "אשר החזרה",
    noReports: "אין דיווחים",
    resolve: "טופל",
    runSweep: "הרץ בדיקת פקיעת חלונות ותזכורות",
  },

  notifications: {
    title: "התראות",
    none: "אין התראות",
    newListingsBy: (name: string, n: number) =>
      n === 1
        ? `${name} העלתה שמלה חדשה`
        : `${name} העלתה ${n} שמלות חדשות`,
    followerNewListing: "מישהי בגובה ובמידה שלך העלתה שמלה",
  },

  chat: {
    title: "צ'אט",
    open: "צ'אט באפליקציה",
    placeholder: "כתבי הודעה…",
    send: "שליחה",
    empty: (name: string) =>
      `זו התחלת השיחה עם ${name}. אפשר לתאם כאן או בוואטסאפ.`,
  },

  payment: {
    methodsLabel: "אמצעי תשלום שאני מקבלת",
    methodsHint: "מוצג לקונות בדף השמלה",
    bitPhoneLabel: "מספר ביט (אם שונה ממספר ההתחברות)",
    // Shown wherever payment is discussed. The core promise.
    disclaimer:
      "התשלום מתבצע באפליקציית ביט בלבד, ישירות בין שתי הצדדות. Closet לא מעבירה כסף, לא מחזיקה כסף ולא שומרת פרטי תשלום — רק מתעדת ששתיכן דיווחתן שהעסקה בוצעה.",
    disclaimerShort: "התשלום בביט בלבד. Closet רק מתעדת שהעסקה קרתה.",
  },

  auth: {
    signInToContinue: "כניסה כדי להמשיך",
    signOut: "התנתקות",
    withPhone: "טלפון",
    withEmail: "אימייל",
    emailPlaceholder: "you@example.com",
    codeHintEmail: "שלחנו לך קוד במייל.",
  },

  report: {
    title: "דיווח",
    reasonLabel: "מה הבעיה?",
    reasons: [
      "תמונות של מישהי אחרת",
      "תוכן פוגעני",
      "פרטים שקריים",
      "אחר",
    ],
    submit: "שליחת דיווח",
    sent: "הדיווח נשלח. תודה.",
  },

  common: {
    cm: 'ס"מ',
    save: "שמירה",
    cancel: "ביטול",
    back: "חזרה",
    loading: "טוען…",
    required: "שדה חובה",
    optional: "רשות",
    yes: "כן",
    no: "לא",
  },
} as const;

// ---- enum label maps -------------------------------------------------------

export const SIZE_HE: Record<Size, string> = {
  XS: "XS",
  S: "S",
  "S-M": "S-M",
  M: "M",
  "M-L": "M-L",
  L: "L",
  XL: "XL",
  XXL: "XXL",
};

export const LENGTH_HE: Record<Length, string> = {
  mini: "מיני",
  midi: "מידי",
  maxi: "מקסי",
};

export const NECKLINE_HE: Record<Neckline, string> = {
  strapless: "סטרפלס",
  v_neck: "מחשוף וי",
  square: "מחשוף מרובע",
  halter: "הולטר",
  one_shoulder: "כתף אחת",
  high_neck: "צווארון גבוה",
  collar: "קולר",
  other: "אחר",
};

export const SLEEVE_HE: Record<Sleeve, string> = {
  sleeveless: "ללא שרוול",
  short: "שרוול קצר",
  three_quarter: "שרוול שלושה רבעים",
  long: "שרוול ארוך",
};

export const BACK_HE: Record<BackStyle, string> = {
  open: "גב פתוח",
  closed: "גב סגור",
};

export const FABRIC_HE: Record<Fabric, string> = {
  satin: "סאטן",
  chiffon: "שיפון",
  lace: "תחרה",
  velvet: "קטיפה",
  tulle: "טול",
  silk: "משי",
  crepe: "קרפ",
  jersey: "ג'רזי",
  organza: "אורגנזה",
  sequin: "פאייטים",
  knit: "סרוג",
  other: "אחר",
};

export const CONDITION_HE: Record<Condition, string> = {
  new_with_tags: "חדש עם תווית",
  like_new: "כמו חדש",
  good: "טוב",
  worn: "לבוש",
};

export const VERDICT_HE: Record<FitVerdict, string> = {
  ran_small: "יצא קטן",
  true_to_size: "מידה מדויקת",
  ran_large: "יצא גדול",
};

export const SHAPE_HE: Record<string, string> = {
  pear: "אגס",
  hourglass: "שעון חול",
  straight: "ישר",
  curvy: "מלא",
  athletic: "אתלטי",
};

export const TX_STATE_HE: Record<TxState, string> = {
  RESERVED: "מתואמות — לתשלום",
  PICKED_UP: "נמסר — חלון החזרה פתוח",
  RETURN_IN_TRANSIT: "בהחזרה",
  COMPLETED: "הושלמה",
  REFUNDED: "הוחזרה",
  CANCELLED: "בוטלה",
  DISPUTED: "במחלוקת",
};

export const PAYMENT_METHOD_HE: Record<PaymentMethod, string> = {
  bit: "ביט",
  cash: "מזומן",
  paybox: "פייבוקס",
  other: "אחר",
};

export const HANDOFF_HE: Record<HandoffMethod, string> = {
  pickup: "איסוף עצמי",
  shipping: "משלוח",
};

export const REQUEST_STATE_HE: Record<PurchaseRequestState, string> = {
  pending: "ממתינה",
  approved: "אושרה",
  declined: "נדחתה",
  expired: "פגה",
  cancelled: "בוטלה",
};

// ---- formatting ----------------------------------------------------------

/** agorot → "₪1,240" */
export function shekels(agorot: number): string {
  const whole = Math.round(agorot / 100);
  return "₪" + whole.toLocaleString("he-IL");
}
