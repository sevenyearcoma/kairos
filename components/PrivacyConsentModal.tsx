
import React, { useMemo } from 'react';
import { Language } from '../types';
import { getT } from '../translations';

interface PrivacyConsentModalProps {
  language: Language;
  onAccept: () => void;
}

const PrivacyConsentModal: React.FC<PrivacyConsentModalProps> = ({ language, onAccept }) => {
  const t = useMemo(() => getT(language), [language]);

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-6">
      {/* Heavy blur backdrop to block the app view */}
      <div className="absolute inset-0 bg-cream/90 backdrop-blur-xl"></div>
      
      <div className="relative w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 border border-charcoal/5 animate-in zoom-in-95 duration-500">
        <div className="flex flex-col items-center text-center space-y-6">
          <div className="size-16 bg-charcoal text-cream rounded-2xl flex items-center justify-center mb-2 shadow-xl">
            <span className="material-symbols-outlined text-3xl">spa</span>
          </div>
          
          <h2 className="text-2xl font-display font-black text-charcoal">{t.privacy.title}</h2>
          
          <p className="text-sm text-charcoal/70 font-medium leading-relaxed">
            {t.privacy.description}
          </p>

          <div className="p-4 bg-beige-soft rounded-2xl border border-charcoal/5">
            <p className="text-[11px] text-charcoal/60 font-bold leading-relaxed">
              {t.privacy.agreement} 
              <a 
                href="/privacy" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-primary hover:text-charcoal underline underline-offset-2 transition-colors"
              >
                {t.privacy.policyLink}
              </a>
              .
            </p>
          </div>

          <button 
            onClick={onAccept}
            className="w-full py-4 bg-primary text-charcoal font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-lg hover:brightness-110 active:scale-95 transition-all"
          >
            {t.privacy.accept}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentModal;