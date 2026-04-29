import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

import jaCommon from "./locales/ja/common.json";
import jaPages from "./locales/ja/pages.json";
import jaErrors from "./locales/ja/errors.json";
import jaForms from "./locales/ja/forms.json";
import enCommon from "./locales/en/common.json";
import enPages from "./locales/en/pages.json";
import enErrors from "./locales/en/errors.json";
import enForms from "./locales/en/forms.json";

void i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ja: {
        common: jaCommon,
        pages: jaPages,
        errors: jaErrors,
        forms: jaForms,
      },
      en: {
        common: enCommon,
        pages: enPages,
        errors: enErrors,
        forms: enForms,
      },
    },
    lng: "ja",
    fallbackLng: "ja",
    defaultNS: "common",
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
  });

export default i18next;
