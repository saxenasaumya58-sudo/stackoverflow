export const locales = ["en", "es", "hi", "pt", "zh", "fr"];
export const defaultLocale = "en";
export const localeCookie = "NEXT_LOCALE";

const localeLoaders = {
  en: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/en/common.json"),
      import("@/locales/en/ui.json"),
      import("@/locales/en/pages.json"),
      import("@/locales/en/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
  es: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/es/common.json"),
      import("@/locales/es/ui.json"),
      import("@/locales/es/pages.json"),
      import("@/locales/es/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
  hi: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/hi/common.json"),
      import("@/locales/hi/ui.json"),
      import("@/locales/hi/pages.json"),
      import("@/locales/hi/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
  pt: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/pt/common.json"),
      import("@/locales/pt/ui.json"),
      import("@/locales/pt/pages.json"),
      import("@/locales/pt/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
  zh: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/zh/common.json"),
      import("@/locales/zh/ui.json"),
      import("@/locales/zh/pages.json"),
      import("@/locales/zh/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
  fr: async () => {
    const [common, ui, pages, security] = await Promise.all([
      import("@/locales/fr/common.json"),
      import("@/locales/fr/ui.json"),
      import("@/locales/fr/pages.json"),
      import("@/locales/fr/security.json"),
    ]);
    return {
      ...common.default,
      ...ui.default,
      ...pages.default,
      ...security.default,
    };
  },
};

const localeMessagePromises = new Map();

export function loadLocaleMessages(language) {
  const locale = locales.includes(language) ? language : defaultLocale;
  if (!localeMessagePromises.has(locale)) {
    localeMessagePromises.set(locale, localeLoaders[locale]());
  }
  return localeMessagePromises.get(locale);
}
