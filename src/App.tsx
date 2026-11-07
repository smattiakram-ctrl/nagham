import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronDown, Cloud, Copy, Heart, ListMusic, LogOut, Mic2, Music2, Pause, Pencil, Play,
  Plus, RefreshCw, SkipBack, SkipForward, Timer, Undo2, Volume2, X,
} from 'lucide-react';
import { db, Line, Song } from './db';
import * as drive from './drive';
import { fmt, parseText, toLrc } from './lrc';

const glass = 'bg-white/5 backdrop-blur-xl border border-white/10';
const grad = 'bg-gradient-to-br from-violet-600 to-fuchsia-500';
type Filter = 'all' | 'local' | 'drive' | 'fav';

function useUrl(b?: Blob) {
  const [u, setU] = useState<string>();
  useEffect(() => {
    if (!b) return setU(undefined);
    const x = URL.createObjectURL(b);
    setU(x);
    return () => URL.revokeObjectURL(x);
  }, [b]);
  return u;
}

function Cover({ song, className = '' }: { song?: Song; className?: string }) {
  const u = useUrl(song?.cover);
  return (
    <div className={`${className} ${grad} overflow-hidden grid place-items-center shrink-0`}>
      {u ? <img src={u} className="w-full h-full object-cover" /> : <Music2 className="w-1/2 h-1/2 text-white/70" />}
    </div>
  );
}

function Lyrics({ lines, time, onSeek }: { lines: Line[]; time: number; onSeek: (t: number) => void }) {
  const idx = useMemo(() => {
    let k = -1;
    lines.forEach((l, i) => { if (l.t != null && l.t <= time) k = i; });
    return k;
  }, [lines, time]);
  const refs = useRef<(HTMLParagraphElement | null)[]>([]);
  useEffect(() => { refs.current[idx]?.scrollIntoView({ behavior: 'smooth', block: 'center' }); }, [idx]);
  if (!lines.length) return <p className="m-auto text-white/40">لا توجد كلمات لهذه الأغنية بعد</p>;
  return (
    <div className="h-full w-full overflow-y-auto py-[30vh] space-y-5 text-center px-4">
      {lines.map((l, i) => (
        <p key={i} ref={(el) => { refs.current[i] = el; }} onClick={() => l.t != null && onSeek(l.t)}
          className={`text-2xl font-bold leading-relaxed transition-all duration-300 ${
            i === idx ? 'text-white scale-105 drop-shadow-[0_0_14px_rgba(232,121,249,.8)]' : 'text-white/30'}`}>
          {l.text}
        </p>
      ))}
    </div>
  );
}

function SyncMode({ song, getTime, seekPlay, onClose }: {
  song: Song; getTime: () => number; seekPlay: (t: number) => void; onClose: () => void;
}) {
  const [lines, setLines] = useState<Line[]>(() => song.lines.map((l) => ({ ...l, t: null })));
  const [idx, setIdx] = useState(0);
  const done = idx >= lines.length;
  useEffect(() => { seekPlay(0); }, []);

  const tap = () => {
    if (done) return;
    const n = [...lines];
    n[idx] = { ...n[idx], t: +getTime().toFixed(2) };
    setLines(n);
    setIdx(idx + 1);
  };
  const undo = () => {
    if (idx === 0) return;
    const n = [...lines];
    n[idx - 1] = { ...n[idx - 1], t: null };
    setLines(n);
    setIdx(idx - 1);
  };
  const finish = async () => { await db.songs.update(song.id, { lines }); onClose(); };
  const tapRef = useRef(tap);
  tapRef.current = tap;
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.code === 'Space') { e.preventDefault(); tapRef.current(); } };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-[#0b0714]/95 backdrop-blur-2xl flex flex-col p-5 pt-[max(env(safe-area-inset-top),28px)]">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">مزامنة الكلمات</h2>
        <button onClick={onClose} className="p-2"><X /></button>
      </div>
      <p className="text-white/50 text-sm mt-1">اضغط الزر مع بداية كل سطر (أو مفتاح المسافة)</p>
      <div className="flex-1 flex flex-col items-center justify-center gap-5 text-center">
        <p className="text-white/30 text-lg min-h-7">{lines[idx - 1]?.text}</p>
        <p className="text-3xl font-bold min-h-20 drop-shadow-[0_0_14px_rgba(232,121,249,.8)]">
          {done ? 'انتهت الأسطر ✓' : lines[idx].text}
        </p>
        <p className="text-white/40 text-lg min-h-7">{lines[idx + 1]?.text}</p>
        <p className="text-white/40 text-sm">{Math.min(idx, lines.length)} / {lines.length}</p>
      </div>
      <div className="flex gap-3 pb-[max(env(safe-area-inset-bottom),16px)]">
        <button onClick={undo} className={`${glass} rounded-2xl px-5 grid place-items-center`}><Undo2 /></button>
        {done ? (
          <button onClick={finish} className={`${grad} flex-1 rounded-2xl py-6 text-xl font-bold`}>حفظ التوقيتات</button>
        ) : (
          <button onClick={tap} className={`${grad} flex-1 rounded-2xl py-6 text-xl font-bold active:scale-95 transition shadow-[0_0_30px_rgba(217,70,239,.5)]`}>
            الآن
          </button>
        )}
      </div>
    </motion.div>
  );
}

function EditSheet({ song, onClose, onSync }: { song: Song; onClose: () => void; onSync: () => void }) {
  const [f, setF] = useState({ title: song.title, artist: song.artist, album: song.album });
  const [text, setText] = useState(song.lines.map((l) => l.text).join('\n'));
  const [cover, setCover] = useState<Blob | undefined>(song.cover);
  const preview = useUrl(cover);
  const save = async () => {
    await db.songs.update(song.id, { ...f, cover, lines: parseText(text, song.lines) });
  };
  const input = `${glass} w-full rounded-xl px-4 py-3 outline-none focus:border-fuchsia-400`;
  return (
    <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="fixed inset-0 z-40 bg-[#120a20]/95 backdrop-blur-2xl overflow-y-auto p-5 pt-[max(env(safe-area-inset-top),28px)] pb-10">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">تعديل الأغنية</h2>
        <button onClick={onClose} className="p-2"><X /></button>
      </div>
      <label className="flex items-center gap-4 mb-4">
        <div className={`w-24 h-24 rounded-2xl overflow-hidden ${grad} grid place-items-center`}>
          {preview ? <img src={preview} className="w-full h-full object-cover" /> : <Music2 />}
        </div>
        <span className={`${glass} rounded-xl px-4 py-2 text-sm`}>تغيير الغلاف</span>
        <input type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && setCover(e.target.files[0])} />
      </label>
      <div className="space-y-3">
        <input className={input} placeholder="العنوان" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
        <input className={input} placeholder="الفنان" value={f.artist} onChange={(e) => setF({ ...f, artist: e.target.value })} />
        <input className={input} placeholder="الألبوم" value={f.album} onChange={(e) => setF({ ...f, album: e.target.value })} />
        <textarea className={`${input} h-56 leading-loose`} placeholder={'الكلمات، سطر لكل بيت\n(يمكنك أيضاً لصق صيغة LRC)'}
          value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="flex gap-3 mt-5">
        <button onClick={async () => { await save(); onClose(); }} className={`${grad} flex-1 rounded-xl py-3 font-bold`}>حفظ</button>
        <button onClick={async () => { await save(); onSync(); }} disabled={!text.trim()}
          className={`${glass} rounded-xl px-4 flex items-center gap-2 disabled:opacity-40`}><Timer size={18} /> مزامنة</button>
        <button onClick={() => navigator.clipboard?.writeText(toLrc(parseText(text, song.lines)))}
          className={`${glass} rounded-xl px-4`} title="نسخ LRC"><Copy size={18} /></button>
      </div>
    </motion.div>
  );
}

export default function App() {
  const songs = useLiveQuery(() => db.songs.orderBy('addedAt').reverse().toArray(), []) ?? [];
  const [filter, setFilter] = useState<Filter>('all');
  const [curId, setCurId] = useState<string>();
  const [full, setFull] = useState(false);
  const [showLyrics, setShowLyrics] = useState(true);
  const [editing, setEditing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [vol, setVol] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [signed, setSigned] = useState(drive.isSignedIn());
  const audio = useRef<HTMLAudioElement>(null);
  const urlRef = useRef<string>();
  const cache = useRef(new Map<string, Blob>());

  const list = songs.filter((s) => filter === 'all' || (filter === 'fav' ? s.fav : s.source === filter));
  const cur = songs.find((s) => s.id === curId);
  const guard = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e: any) { setErr(e?.message || String(e)); } finally { setBusy(false); }
  };

  const play = (s: Song) => guard(async () => {
    setCurId(s.id);
    let blob = s.blob ?? cache.current.get(s.id);
    if (!blob && s.driveId) { blob = await drive.fetchAudio(s.driveId); cache.current.set(s.id, blob); }
    if (!blob) throw new Error('الملف غير متوفر');
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(blob);
    const a = audio.current!;
    a.src = urlRef.current;
    await a.play();
  });

  const step = (d: number) => {
    if (!list.length) return;
    const i = list.findIndex((s) => s.id === curId);
    play(list[(i + d + list.length) % list.length]);
  };
  const toggle = () => { const a = audio.current!; a.paused ? a.play() : a.pause(); };
  const seek = (t: number) => { audio.current!.currentTime = t; };

  useEffect(() => {
    if (!cur || !('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title: cur.title, artist: cur.artist, album: cur.album });
    navigator.mediaSession.setActionHandler('play', toggle);
    navigator.mediaSession.setActionHandler('pause', toggle);
    navigator.mediaSession.setActionHandler('nexttrack', () => step(1));
    navigator.mediaSession.setActionHandler('previoustrack', () => step(-1));
  });

  const addLocal = (files: FileList | null) => guard(async () => {
    if (!files) return;
    await db.songs.bulkAdd([...files].map((f, i) => ({
      id: 'local:' + crypto.randomUUID(), title: f.name.replace(/\.[^.]+$/, ''), artist: '', album: '',
      source: 'local' as const, mime: f.type, blob: f, lines: [], fav: 0 as const, addedAt: Date.now() + i,
    })));
  });

  const syncDrive = () => guard(async () => {
    if (!drive.isSignedIn()) { await drive.signIn(); setSigned(true); }
    const files = await drive.listAudio();
    const have = new Set(await db.songs.toCollection().primaryKeys());
    await db.songs.bulkAdd(files.filter((f) => !have.has('drive:' + f.id)).map((f, i) => ({
      id: 'drive:' + f.id, driveId: f.id, title: f.name.replace(/\.[^.]+$/, ''), artist: '', album: '',
      source: 'drive' as const, mime: f.mimeType, lines: [], fav: 0 as const, addedAt: Date.now() + i,
    })));
  });

  const chips: [Filter, string][] = [['all', 'الكل'], ['local', 'على الجهاز'], ['drive', 'Drive'], ['fav', 'المفضلة']];
  const cover = useUrl(cur?.cover);

  return (
    <div className="h-full flex flex-col relative overflow-hidden bg-[radial-gradient(ellipse_at_top,#2a1050_0%,#0b0714_60%)]">
      <audio ref={audio}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)}
        onEnded={() => step(1)} />

      {/* Header */}
      <header className="px-5 pt-[max(env(safe-area-inset-top),28px)] pb-3">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-black bg-gradient-to-l from-pink-400 to-violet-400 bg-clip-text text-transparent">
            نغم <span className="text-base font-semibold text-white/50">Nagham</span>
          </h1>
          <div className="flex gap-2">
            <label className={`${glass} p-2.5 rounded-xl`} title="إضافة ملفات من الجهاز">
              <Plus size={20} />
              <input type="file" accept="audio/*" multiple hidden onChange={(e) => { addLocal(e.target.files); e.target.value = ''; }} />
            </label>
            <button onClick={syncDrive} className={`${glass} p-2.5 rounded-xl`} title="Google Drive">
              {busy ? <RefreshCw size={20} className="animate-spin" /> : <Cloud size={20} />}
            </button>
            {signed && (
              <button onClick={() => { drive.signOut(); setSigned(false); }} className={`${glass} p-2.5 rounded-xl`} title="تسجيل الخروج">
                <LogOut size={20} />
              </button>
            )}
          </div>
        </div>
        <div className="flex gap-2 mt-4 overflow-x-auto">
          {chips.map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)}
              className={`px-4 py-1.5 rounded-full text-sm whitespace-nowrap ${filter === k ? grad : glass}`}>{l}</button>
          ))}
        </div>
        {err && <p className="mt-3 text-sm text-pink-300 bg-pink-500/10 rounded-xl px-3 py-2">{err}</p>}
      </header>

      {/* Library */}
      <main className="flex-1 overflow-y-auto px-4 pb-28">
        {list.length === 0 && (
          <div className="text-center text-white/40 mt-24 space-y-3">
            <ListMusic className="mx-auto" size={44} />
            <p>المكتبة فارغة. أضف ملفات من جهازك أو اربط Google Drive.</p>
          </div>
        )}
        {list.map((s) => (
          <div key={s.id} onClick={() => play(s)}
            className={`flex items-center gap-3 p-2.5 rounded-2xl mb-1 ${s.id === curId ? 'bg-white/10' : ''}`}>
            <Cover song={s} className="w-12 h-12 rounded-xl" />
            <div className="flex-1 min-w-0">
              <p className="truncate font-semibold">{s.title}</p>
              <p className="truncate text-sm text-white/50">{s.artist || 'فنان غير معروف'}{s.album && ` · ${s.album}`}</p>
            </div>
            {s.source === 'drive' && <Cloud size={14} className="text-white/30" />}
            <button onClick={(e) => { e.stopPropagation(); db.songs.update(s.id, { fav: s.fav ? 0 : 1 }); }} className="p-2">
              <Heart size={18} className={s.fav ? 'fill-pink-500 text-pink-500' : 'text-white/30'} />
            </button>
          </div>
        ))}
      </main>

      {/* Mini player */}
      {cur && !full && (
        <div onClick={() => setFull(true)}
          className={`${glass} absolute bottom-3 inset-x-3 rounded-2xl p-2.5 flex items-center gap-3 mb-[env(safe-area-inset-bottom)]`}>
          <Cover song={cur} className="w-11 h-11 rounded-xl" />
          <div className="flex-1 min-w-0">
            <p className="truncate font-semibold text-sm">{cur.title}</p>
            <p className="truncate text-xs text-white/50">{cur.artist || 'فنان غير معروف'}</p>
          </div>
          <button onClick={(e) => { e.stopPropagation(); toggle(); }} className={`${grad} p-3 rounded-full`}>
            {playing ? <Pause size={18} /> : <Play size={18} />}
          </button>
          <div className="absolute bottom-0 inset-x-4 h-0.5 bg-white/10" dir="ltr">
            <div className="h-full bg-fuchsia-400" style={{ width: `${dur ? (time / dur) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      {/* Now playing */}
      <AnimatePresence>
        {full && cur && (
          <motion.div key="np" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 260 }}
            className="fixed inset-0 z-30 bg-[#0b0714] flex flex-col pt-[max(env(safe-area-inset-top),28px)] pb-[max(env(safe-area-inset-bottom),16px)]">
            {cover && <img src={cover} className="absolute inset-0 w-full h-full object-cover scale-125 blur-3xl opacity-40" />}
            <div className="absolute inset-0 bg-gradient-to-b from-violet-950/60 to-black/80" />
            <div className="relative flex items-center justify-between px-5">
              <button onClick={() => setFull(false)} className="p-2"><ChevronDown /></button>
              <span className="text-sm text-white/60">يُشغَّل الآن</span>
              <button onClick={() => setEditing(true)} className="p-2"><Pencil size={20} /></button>
            </div>

            <div className="relative flex-1 min-h-0 flex flex-col md:flex-row items-center gap-6 px-6 py-4">
              <div className={`${showLyrics ? 'hidden md:flex' : 'flex'} flex-col items-center justify-center md:flex-1 gap-5`}>
                <Cover song={cur} className="w-[68vw] max-w-80 aspect-square rounded-3xl shadow-[0_20px_70px_rgba(168,85,247,.5)]" />
                <div className="text-center">
                  <h2 className="text-2xl font-bold">{cur.title}</h2>
                  <p className="text-white/60">{cur.artist || 'فنان غير معروف'}{cur.album && ` · ${cur.album}`}</p>
                </div>
              </div>
              <div className={`${showLyrics ? 'flex' : 'hidden md:flex'} flex-1 min-h-0 w-full h-full`}>
                <Lyrics lines={cur.lines} time={time} onSeek={seek} />
              </div>
            </div>

            <div className="relative px-6 space-y-3" dir="ltr">
              <input type="range" min={0} max={dur || 0} step={0.1} value={time} onChange={(e) => seek(+e.target.value)} className="w-full" />
              <div className="flex justify-between text-xs text-white/50"><span>{fmt(time)}</span><span>{fmt(dur)}</span></div>
              <div className="flex items-center justify-between">
                <button onClick={() => db.songs.update(cur.id, { fav: cur.fav ? 0 : 1 })} className="p-2">
                  <Heart className={cur.fav ? 'fill-pink-500 text-pink-500' : 'text-white/60'} />
                </button>
                <div className="flex items-center gap-5">
                  <button onClick={() => step(-1)}><SkipBack size={28} /></button>
                  <button onClick={toggle} className={`${grad} p-5 rounded-full shadow-[0_0_30px_rgba(217,70,239,.6)]`}>
                    {playing ? <Pause size={30} /> : <Play size={30} />}
                  </button>
                  <button onClick={() => step(1)}><SkipForward size={28} /></button>
                </div>
                <button onClick={() => setShowLyrics(!showLyrics)} className="p-2">
                  <Mic2 className={showLyrics ? 'text-fuchsia-400' : 'text-white/60'} />
                </button>
              </div>
              <div className="hidden md:flex items-center gap-2 justify-center">
                <Volume2 size={18} />
                <input type="range" min={0} max={1} step={0.01} value={vol}
                  onChange={(e) => { setVol(+e.target.value); audio.current!.volume = +e.target.value; }} className="w-40" />
              </div>
            </div>
          </motion.div>
        )}
        {editing && cur && <EditSheet key="ed" song={cur} onClose={() => setEditing(false)}
          onSync={() => { setEditing(false); setSyncing(true); }} />}
        {syncing && cur && <SyncMode key="sy" song={cur} getTime={() => audio.current!.currentTime}
          seekPlay={(t) => { seek(t); audio.current!.play(); }} onClose={() => setSyncing(false)} />}
      </AnimatePresence>
    </div>
  );
}
