import React, { useMemo } from 'react';
import { useStore } from '@nanostores/react';
import { $prefs, $language, $isGoogleConnected, $lastSyncTime, $isSyncing, syncGoogleData, disconnectGoogle } from '../stores/app';
import { getT } from '../translations';

const Header: React.FC<{ currentPath: string }> = () => {
  const prefs = useStore($prefs);
  const language = useStore($language);
  const isGoogleConnected = useStore($isGoogleConnected);
  const lastSyncTime = useStore($lastSyncTime);
  const isSyncing = useStore($isSyncing);
  const t = useMemo(() => getT(language), [language]);

  const handleSyncGoogle = () => {
    const token = localStorage.getItem('kairos_google_token');
    if (token) syncGoogleData(token);
    else if ((window as any).__kairosRequestGoogleAuth) (window as any).__kairosRequestGoogleAuth();
  };

  return (
    <header className="h-20 border-b border-charcoal/5 flex items-center px-6 md:px-10 justify-between bg-white/80 backdrop-blur-xl sticky top-0 z-40 shrink-0">
      <h1 className="text-[11px] font-black uppercase tracking-[0.25em] text-charcoal/20">
        {prefs.assistantName} — {prefs.userName}
      </h1>
      <div className="flex items-center gap-2">
        {isGoogleConnected ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncGoogle}
              disabled={isSyncing}
              title={`${t.common.syncedAt} ${lastSyncTime || '...'}`}
              className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-primary/5 border border-primary/20 text-primary hover:bg-primary/10 transition-all shadow-sm"
            >
              <span className={`material-symbols-outlined text-[18px] ${isSyncing ? 'animate-spin' : ''}`}>sync</span>
              <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">
                {isSyncing ? t.common.syncing : t.common.syncNow}
              </span>
            </button>
            <button
              onClick={disconnectGoogle}
              title={t.common.disconnect}
              className="size-9 flex items-center justify-center rounded-full bg-white border border-charcoal/10 text-charcoal/20 hover:text-red-500 hover:bg-red-50 hover:border-red-200 transition-all shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleSyncGoogle}
            className="flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white border border-charcoal/10 text-charcoal/40 hover:text-charcoal hover:bg-charcoal/5 transition-all shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px]">cloud_off</span>
            <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">{t.common.linkGoogle}</span>
          </button>
        )}
        <div className="flex bg-beige-soft border border-charcoal/5 rounded-full p-1 ml-2">
          <button
            onClick={() => $language.set('en')}
            className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'en' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}
          >
            EN
          </button>
          <button
            onClick={() => $language.set('ru')}
            className={`px-3 py-1 text-[10px] font-black rounded-full transition-all ${language === 'ru' ? 'bg-charcoal text-cream' : 'text-charcoal/30'}`}
          >
            RU
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
