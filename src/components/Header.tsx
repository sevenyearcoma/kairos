import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useStore } from '@nanostores/react';
import { $language, $prefs, $isGoogleConnected, $lastSyncTime, $isSyncing, requestGoogleSync, disconnectGoogle } from '../stores/app';
import { getT } from '../translations';

const Header: React.FC<{ currentPath: string }> = ({ currentPath }) => {
  const language = useStore($language);
  const prefs = useStore($prefs);
  const isGoogleConnected = useStore($isGoogleConnected);
  const lastSyncTime = useStore($lastSyncTime);
  const isSyncing = useStore($isSyncing);
  const t = useMemo(() => getT(language), [language]);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!settingsOpen) return;
    const onClick = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) setSettingsOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSettingsOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [settingsOpen]);

  const handleSyncGoogle = requestGoogleSync;

  const title = currentPath === '/'
    ? 'capture'
    : currentPath === '/tasks'
    ? 'today'
    : currentPath === '/calendar'
    ? 'your week'
    : 'focus';

  const toggleTheme = () => $prefs.set({ ...prefs, theme: prefs.theme === 'dark' ? 'cream' : 'dark' });

  return (
    <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center justify-between border-b border-charcoal/[0.05] bg-cream/90 px-4 backdrop-blur-xl md:h-16 md:border-b-0 md:bg-transparent md:px-12">
      <button
        type="button"
        onClick={() => setSettingsOpen(v => !v)}
        className="flex size-8 items-center justify-center rounded-full text-charcoal/70 transition hover:bg-charcoal/[0.04] md:hidden"
        title="Menu"
      >
        <span className="material-symbols-outlined text-[18px]">menu</span>
      </button>

      <div className="hidden md:block" />

      <h1 className="font-display text-[17px] italic leading-none text-charcoal md:hidden">{title}</h1>

      <div className="flex items-center gap-1.5 md:gap-5">
        <button
          onClick={toggleTheme}
          title={prefs.theme === 'dark' ? 'light mode' : 'dark mode'}
          className="flex size-8 items-center justify-center rounded-full text-charcoal/45 transition hover:bg-charcoal/[0.04] hover:text-charcoal md:text-muted-ink md:hover:text-sage-deep md:hover:bg-transparent"
        >
          <span className="material-symbols-outlined text-[18px]">
            {prefs.theme === 'dark' ? 'light_mode' : 'dark_mode'}
          </span>
        </button>
        {isGoogleConnected ? (
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleSyncGoogle}
              disabled={isSyncing}
              title={`${t.common.syncedAt} ${lastSyncTime || '...'}`}
              className="flex size-8 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary transition hover:bg-primary/20 md:border-none md:bg-transparent md:text-muted-ink"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleSyncGoogle}
            title={t.common.linkGoogle}
            className="flex size-8 items-center justify-center rounded-full border border-charcoal/10 bg-white/55 text-charcoal/45 transition hover:text-charcoal md:border-none md:bg-transparent md:text-muted-ink"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
          </button>
        )}
        <button
          onClick={() => setSettingsOpen(v => !v)}
          title="Settings"
          className="hidden text-muted-ink transition hover:text-sage-deep md:flex"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </div>

      {settingsOpen && (
        <div
          ref={settingsRef}
          className="absolute right-4 top-14 z-50 w-72 stitch-card rounded-2xl p-5 shadow-xl md:right-12 md:top-16"
        >
          <p className="mb-3 text-[9px] uppercase tracking-widest text-muted-ink">your name</p>
          <input
            value={prefs.userName}
            onChange={e => $prefs.set({ ...prefs, userName: e.target.value })}
            className="w-full rounded-lg bg-beige-soft/60 px-3 py-2 text-sm text-charcoal focus:ring-1 focus:ring-primary/30 border-none mb-5"
            placeholder="name"
          />

          <p className="mb-3 text-[9px] uppercase tracking-widest text-muted-ink">theme</p>
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => $prefs.set({ ...prefs, theme: 'cream' })}
              className={`flex-1 rounded-full py-2 text-xs transition ${prefs.theme !== 'dark' ? 'bg-primary/25 text-charcoal' : 'bg-beige-soft/40 text-muted-ink'}`}
            >light</button>
            <button
              onClick={() => $prefs.set({ ...prefs, theme: 'dark' })}
              className={`flex-1 rounded-full py-2 text-xs transition ${prefs.theme === 'dark' ? 'bg-primary/25 text-charcoal' : 'bg-beige-soft/40 text-muted-ink'}`}
            >dark</button>
          </div>

          <p className="mb-3 text-[9px] uppercase tracking-widest text-muted-ink">language</p>
          <div className="mb-5 flex gap-2">
            <button
              onClick={() => $language.set('en')}
              className={`flex-1 rounded-full py-2 text-xs transition ${language === 'en' ? 'bg-primary/25 text-charcoal' : 'bg-beige-soft/40 text-muted-ink'}`}
            >english</button>
            <button
              onClick={() => $language.set('ru')}
              className={`flex-1 rounded-full py-2 text-xs transition ${language === 'ru' ? 'bg-primary/25 text-charcoal' : 'bg-beige-soft/40 text-muted-ink'}`}
            >русский</button>
          </div>

          {isGoogleConnected && (
            <>
              <p className="mb-3 text-[9px] uppercase tracking-widest text-muted-ink">google</p>
              <button
                onClick={() => { disconnectGoogle(); setSettingsOpen(false); }}
                className="w-full rounded-full bg-[#C87C5E]/10 py-2 text-xs text-[#C87C5E] hover:bg-[#C87C5E]/20 transition flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-[16px]">logout</span>
                {t.common.disconnect}
              </button>
            </>
          )}
        </div>
      )}
    </header>
  );
};

export default Header;
