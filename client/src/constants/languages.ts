/**
 * Supported languages configuration
 * 
 * To add a new language:
 * 1. Create translation files in client/src/locales/{code}/
 * 2. Update i18n/config.ts to import and register the new language
 * 3. Add the language to SUPPORTED_LANGUAGES below
 */

export interface SupportedLanguage {
  code: string;
  name: string; // Native language name (fallback)
  nameKey: string; // Translation key for the language name
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  {
    code: 'en',
    name: 'English',
    nameKey: 'settings.languages.english',
  },
  // Add more languages here as they become available
  // Example:
  // {
  //   code: 'es',
  //   name: 'Español',
  //   nameKey: 'settings.languages.spanish',
  {
    code: 'es',
    name: 'Español',
    nameKey: 'settings.languages.spanish',
  },
];

