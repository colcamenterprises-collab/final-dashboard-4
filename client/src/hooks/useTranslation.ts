import { useState, useEffect } from 'react';
import enTranslations from '../i18n/en.json';
import thTranslations from '../i18n/th.json';

const translations = {
  en: enTranslations,
  th: thTranslations
};

export function useTranslation() {
  const [language, setLanguage] = useState<'en' | 'th'>('en');

  const t = (key: string) => {
    const keys = key.split('.');
    let value: any = translations[language];
    
    for (const k of keys) {
      value = value?.[k];
    }
    
    return value || key;
  };

  const i18n = {
    language,
    changeLanguage: setLanguage
  };

  return { t, i18n };
}