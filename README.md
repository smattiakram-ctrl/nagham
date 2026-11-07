# نغم · Nagham (Android)

React + Tailwind + Dexie (IndexedDB) + Framer Motion، مغلّف بـ Capacitor.

## 1) Google Cloud (مرة واحدة)
1. فعّل **Google Drive API** في مشروعك.
2. OAuth consent screen: أضف حسابك في **Test users**.
3. Credentials ← Create OAuth client ID ← النوع **Android**:
   - Package name: `com.nagham.app`
   - SHA-1: `E4:5E:C3:C3:D1:83:A9:D2:E6:83:66:F9:11:9F:98:AC:7E:F9:68:BF`
   - من Advanced settings فعّل **Enable custom URI scheme**.
4. انسخ الـ Client ID (ينتهي بـ `.apps.googleusercontent.com`).

## 2) بناء الـ APK من GitHub (بدون Android Studio)
1. ارفع محتويات هذا المجلد إلى مستودع GitHub جديد (فرع `main`).
2. Settings ← Secrets and variables ← Actions ← New secret:
   الاسم `GOOGLE_CLIENT_ID` والقيمة هي الـ Client ID.
3. تبويب Actions ← **Build APK** ← Run workflow.
4. بعد انتهائه نزّل `nagham-apk` من Artifacts، فك الضغط، وثبّت `app-debug.apk`.

## تشغيل محلي (للتجربة في المتصفح)
`npm install && npm run dev`
(تسجيل Google يعمل على الأندرويد فقط؛ الملفات المحلية تعمل في المتصفح.)
