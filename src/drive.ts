import { App } from '@capacitor/app';
import { Browser } from '@capacitor/browser';

const CID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) || '';
const SCHEME = `com.googleusercontent.apps.${CID.split('.')[0]}`;
const REDIRECT = `${SCHEME}:/oauth2redirect`;
const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const KEY = 'nagham_auth';

type Auth = { access: string; refresh?: string; exp: number };
const load = (): Auth | null => JSON.parse(localStorage.getItem(KEY) || 'null');
const save = (a: Auth) => localStorage.setItem(KEY, JSON.stringify(a));

export const isSignedIn = () => !!load();
export const signOut = () => localStorage.removeItem(KEY);

const b64url = (b: ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const rand = () => b64url(crypto.getRandomValues(new Uint8Array(48)).buffer);

async function token(body: Record<string, string>): Promise<Auth> {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CID, ...body }),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(j.error_description || j.error || 'فشل تسجيل الدخول');
  return { access: j.access_token, refresh: j.refresh_token ?? load()?.refresh, exp: Date.now() + j.expires_in * 1000 - 60000 };
}

// OAuth 2.0 + PKCE through Chrome Custom Tabs (Google blocks sign-in inside WebViews)
export async function signIn() {
  if (!CID) throw new Error('VITE_GOOGLE_CLIENT_ID غير مضبوط');
  const verifier = rand();
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const params = new URLSearchParams({
    client_id: CID, redirect_uri: REDIRECT, response_type: 'code', scope: SCOPE,
    code_challenge: challenge, code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent',
  });
  const code = await new Promise<string>(async (res, rej) => {
    const h = await App.addListener('appUrlOpen', ({ url }) => {
      if (!url.startsWith(SCHEME)) return;
      h.remove();
      Browser.close().catch(() => {});
      const c = new URL(url).searchParams.get('code');
      c ? res(c) : rej(new Error('تم إلغاء تسجيل الدخول'));
    });
    await Browser.open({ url: 'https://accounts.google.com/o/oauth2/v2/auth?' + params });
  });
  save(await token({ code, code_verifier: verifier, redirect_uri: REDIRECT, grant_type: 'authorization_code' }));
}

async function access(): Promise<string> {
  let a = load();
  if (!a) throw new Error('سجّل الدخول أولاً');
  if (Date.now() > a.exp) {
    if (!a.refresh) { signOut(); throw new Error('انتهت الجلسة، سجّل الدخول مجدداً'); }
    a = await token({ refresh_token: a.refresh, grant_type: 'refresh_token' });
    save(a);
  }
  return a.access;
}

const API = 'https://www.googleapis.com/drive/v3/files';
export type DriveFile = { id: string; name: string; mimeType: string };

export async function listAudio(): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      q: "mimeType contains 'audio/' and trashed=false",
      fields: 'nextPageToken,files(id,name,mimeType)',
      pageSize: '200', orderBy: 'name',
    });
    if (pageToken) q.set('pageToken', pageToken);
    const r = await fetch(`${API}?${q}`, { headers: { Authorization: 'Bearer ' + (await access()) } });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error?.message || 'فشل جلب الملفات');
    out.push(...j.files);
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

// <audio> can't send an Authorization header, so the authenticated stream is fetched into a Blob.
export async function fetchAudio(id: string): Promise<Blob> {
  const r = await fetch(`${API}/${id}?alt=media`, { headers: { Authorization: 'Bearer ' + (await access()) } });
  if (!r.ok) throw new Error('تعذّر تحميل الملف من Drive');
  return r.blob();
}
