import i18next from 'i18next';
import { initReactI18next } from 'react-i18next';
import gameDataEn from '../locales/en/gameData.json';
import uiEn from '../locales/en/ui.json';
import commonEn from '../locales/en/common.json';

i18next
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        gameData: gameDataEn,
        ui: uiEn,
        common: commonEn,
      },
    },
    lng: 'en', // Default language
    fallbackLng: 'en',
    defaultNS: 'ui',
    ns: ['gameData', 'ui', 'common'],
    interpolation: {
      escapeValue: false, // React already escapes values
    },
    react: {
      useSuspense: false, // Disable suspense for better compatibility
    },
  });

export default i18next;

