# פריסה לאוויר — Railway + Twilio

מדריך צעד־אחר־צעד להעלות את Closet לאוויר ולפתוח אותו ל־40 חברות.
כל הקוד כבר מוכן — צריך רק להקים חשבונות ולהדביק מפתחות.

עלות חודשית משוערת: **~$5 (Railway) + ~$1–5 (Twilio, לפי כמות SMS) + ~$10–30 לשנה (דומיין).**

---

## מה קורה עם ביט — קראי קודם

**ביט P2P אין לו API.** האפליקציה לא יכולה ולא צריכה "לבצע" תשלום בביט —
היא מציגה את הסכום, את מספר הביט של המוכרת ואת קוד הייחוס (`CL-####`), ורושמת
ששתיכן דיווחתן שהעסקה בוצעה. **הכסף עובר בביט ישירות בין שתי הנשים.** אין מה
להקים. זה בכוונה — ככה Closet נשארת פרויקט פרטי בלי עוסק ובלי מע"מ.

תשלום *מאומת* (webhook מביט) דורש "ביט לעסקים" → עוסק פטור/מורשה + חוזה עם סולק
(Grow / PayPlus / Tranzila). זה פרויקט v2 עם השלכות מס — **תתייעצי עם רו"ח לפני.**

---

## שלב 1 — קוד ב-GitHub

1. פותחים חשבון ב-github.com (חינם).
2. יוצרים repo פרטי חדש, למשל `closet`.
3. מהתיקייה הזו:
   ```bash
   git init
   git add .
   git commit -m "Closet"
   git branch -M main
   git remote add origin https://github.com/<שם-משתמש>/closet.git
   git push -u origin main
   ```

---

## שלב 2 — Twilio (קודי SMS + התראות)

1. נרשמים ב-twilio.com. באזור/מדינה בוחרים **Israel**.
2. **קונים מספר טלפון** (Phone Numbers → Buy a number) — כל מספר עם יכולת SMS.
   זהו ה־`TWILIO_SMS_FROM`. ~$1–2 לחודש.
3. **יוצרים Verify Service** (Verify → Services → Create):
   - Friendly name: `Closet`
   - שומרים את ה־**Service SID** (מתחיל ב-`VA`) → זה `TWILIO_VERIFY_SERVICE_SID`.
4. מ-Console (עמוד הבית של Twilio) מעתיקים:
   - **Account SID** (`AC...`) → `TWILIO_ACCOUNT_SID`
   - **Auth Token** → `TWILIO_AUTH_TOKEN`
5. **רישום A2P / Toll-Free** — Twilio ידרוש רישום כדי לשלוח SMS. עוברים את
   האשף (Messaging → Regulatory / A2P). לוקח יום-יומיים לאישור. Verify עצמו
   עובד גם בזמן ההמתנה ברוב המקרים.

> טיפ לבדיקה מהירה: בזמן שהרישום ממתין, אפשר להוסיף את מספרי החברות כ-**Verified
> Caller IDs** ב-Twilio — SMS אליהן יעבוד מיד.

---

## שלב 3 — Railway

1. נרשמים ב-railway.com (עם GitHub).
2. **New Project → Deploy from GitHub repo →** בוחרים את `closet`.
   Railway יזהה את ה-`Dockerfile` אוטומטית.
3. **Volume** (חשוב! בלי זה כל הנתונים נמחקים בכל deploy):
   - בשירות → **Settings → Volumes → New Volume**
   - Mount path: **`/data`**
4. **Variables** (Settings → Variables) — מדביקים:

   | שם | ערך |
   |---|---|
   | `SESSION_SECRET` | מריצים `openssl rand -hex 32` ומדביקים את התוצאה |
   | `CRON_SECRET` | עוד `openssl rand -hex 32` |
   | `PUBLIC_URL` | הכתובת של Railway (מופיעה ב-Settings → Domains), למשל `https://closet-production.up.railway.app` |
   | `ADMIN_PHONES` | מספר הטלפון שלך, למשל `054-1234567` |
   | `TWILIO_ACCOUNT_SID` | מ-Twilio |
   | `TWILIO_AUTH_TOKEN` | מ-Twilio |
   | `TWILIO_VERIFY_SERVICE_SID` | ה-`VA...` |
   | `TWILIO_SMS_FROM` | מספר ה-Twilio שקנית, בפורמט `+1...` |
   | `NEXT_PUBLIC_SMS_LIVE` | `1` |
   | `DATA_DIR` | `/data` |

   אופציונלי: `AI_DRIVER=claude` + `ANTHROPIC_API_KEY` למילוי אוטומטי אמיתי מתמונה.

   אופציונלי (חוסך SMS): `SMS_NOTIFICATIONS` — `critical` (ברירת מחדל, רק
   "מישהי רוצה את השמלה שלך" ו"הבקשה אושרה") / `all` / `off`.
5. **Deploy.** אחרי דקה-שתיים השירות עולה. פותחים את הכתובת מ-Settings → Domains.
6. אחרי ה-deploy הראשון, אם שינית `PUBLIC_URL` — עושים redeploy.

---

## שלב 3.5 — כניסה עם אימייל (אופציונלי, חוסך SMS)

המשתמשות מתחברות פעם אחת בטלפון, מוסיפות אימייל בפרופיל, ומאז יכולות להתחבר
עם קוד במייל בלי SMS. הטלפון נשאר הזהות הראשית (ביט + וואטסאפ צריכים אותו).

בוחרים **אחת** מהאפשרויות ומוסיפים ל-Variables ב-Railway:

**א. Gmail (עובד מיד, מומלץ לפיילוט)** — ב-Google Account → Security →
2-Step Verification → **App passwords** יוצרים סיסמה בת 16 תווים:

| שם | ערך |
|---|---|
| `SMTP_HOST` | `smtp.gmail.com` |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | כתובת ה-Gmail שלך |
| `SMTP_PASS` | סיסמת האפליקציה (16 תווים, לא סיסמת הכניסה) |
| `EMAIL_FROM` | `Closet <your.address@gmail.com>` |

**ב. Resend (איכות שליחה טובה יותר, צריך דומיין מאומת)** — נרשמים ב-resend.com,
מאמתים דומיין (מוסיפים כמה רשומות DNS), ומוסיפים:

| שם | ערך |
|---|---|
| `RESEND_API_KEY` | מ-resend.com |
| `EMAIL_FROM` | `Closet <closet@yourdomain.com>` (על הדומיין המאומת) |

בלי אף אחת מהן — כפתור "אימייל" עדיין מופיע אבל יחזיר שגיאה; טלפון עובד כרגיל.

---

## שלב 4 — דומיין (אופציונלי אבל מומלץ)

1. קונים דומיין (names.co.il, Cloudflare, Namecheap). למשל `closet.co.il`.
2. ב-Railway: Settings → Domains → **Custom Domain** → מזינים את הדומיין.
3. אצל ספק הדומיין מוסיפים רשומת **CNAME** לפי מה ש-Railway נותן.
4. מעדכנים `PUBLIC_URL` לדומיין החדש ו-redeploy.

---

## שלב 5 — Cron (פקיעות, תזכורות, סיכום שבועי)

Railway לא מריץ cron מובנה בקלות. הכי פשוט — **cron-job.org** (חינם):

1. נרשמים ל-cron-job.org.
2. Job 1: URL `https://<הכתובת>/api/cron/sweep?secret=<CRON_SECRET>` — כל 15 דקות.
3. Job 2: URL `https://<הכתובת>/api/cron/kpi-snapshot?secret=<CRON_SECRET>` —
   יום שני 08:00.

(בכל רגע אפשר גם ללחוץ "הרץ בדיקה" ידנית מ-`/admin`.)

---

## שלב 6 — כניסה ראשונה + זריעת שמלות

1. נכנסים לאתר, מזינים את **מספר הטלפון שלך** (זה שב-`ADMIN_PHONES`).
   הקוד יגיע ב-SMS אמיתי.
2. עכשיו את admin — יש קישור **ניהול** בתפריט התחתון, ו-`/admin/kpi` ללוח המדדים.
3. **לפני שפותחים לחברות:** מעלים 30–50 שמלות אמיתיות דרך `מכירה` (משלך ומ-5
   חברות), עם תמונות על הגוף, ופרוסות על טווח מידות (S–XL) וגבהים (155–178).
   משתמשת חדשה שרואה 0 התאמות ביום הראשון = הכישלון העיקרי של הפיילוט.
4. בודקים ב-`/admin/kpi → כיסוי מידות` שאין תא עם פחות מ-3 שמלות חיות.

---

## שלב 7 — משפטי (חשוב לאפליקציה עם תמונות של נשים)

לפני פתיחה לחברות, כתבי פסקה קצרה של תנאי שימוש + פרטיות שמופיעה באונבורדינג:
- מידות ותמונות נשמרות אצלנו בלבד, לא נמסרות לאף שירות חיצוני.
- מספר הטלפון נחשף לצד השני רק אחרי שאת מאשרת בקשה ספציפית.
- העלאת תמונות של מישהי אחרת = חסימה לצמיתות.
- התשלום בביט בין שתי הנשים; Closet לא מעבירה כסף.

(אפשר להוסיף כדף סטטי או טקסט במסך הפתיחה — תגידי לי ואוסיף.)

---

## תחזוקה

* **גיבוי:** אחת לשבוע הורידי עותק של `/data/db.json` (Railway → Volume → אפשר
  להתחבר ב-`railway run` או דרך shell). זו כל מסת הנתונים.
* **עדכון קוד:** `git push` → Railway עושה deploy אוטומטית.
* **מגבלה שכדאי לדעת:** האחסון הוא קובץ JSON יחיד. זה מצוין ל-40 חברות. אם זה
  גדל משמעותית — עוברים ל-Supabase (הסכימה כבר כתובה ב-`supabase/migrations/`,
  צריך לממש קובץ אחד: `src/lib/db/supabase.ts`). לכן: **replicas = 1** ב-Railway.
