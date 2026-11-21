"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { loadLocaleMessages, locales } from "@/lib/i18n/config";
import { pageTranslations, translations } from "@/lib/translations";
import { clearClientCache } from "@/lib/client-cache";

const defaultMessages = translations.en;
const supportedLanguages = new Set(locales);
const emptyLocale = {};

export function translateServerMessage(
  status,
  t,
  { rateLimitKey = "requestFailed", unauthorizedKey = "requestFailed" } = {},
) {
  if (status === 401) return t[unauthorizedKey];
  if (status === 429) return t[rateLimitKey];
  if (status >= 500) return t.serverError;
  return t.requestFailed;
}

function makeTranslator(messages, nestedMessages = {}) {
  const translate = (key) => {
    const direct = messages[key];
    if (direct !== undefined) return direct;
    const nested = String(key)
      .split(".")
      .reduce((value, part) => value?.[part], nestedMessages);
    return nested ?? key;
  };
  return new Proxy(translate, {
    get(target, property, receiver) {
      if (typeof property === "string" && property in messages)
        return messages[property];
      return Reflect.get(target, property, receiver);
    },
  });
}
const defaultTranslator = makeTranslator(defaultMessages);
const LanguageContext = createContext({
  language: "en",
  setLanguage: () => {},
  t: defaultTranslator,
  user: null,
  setUser: () => {},
  authLoaded: false,
});

function saveLanguagePreference(language) {
  if (!supportedLanguages.has(language)) return;
  document.cookie = `NEXT_LOCALE=${language}; path=/; max-age=31536000; samesite=lax`;
  document.cookie = `lang=${language}; path=/; max-age=31536000; samesite=lax`;
}

export function LanguageProvider({
  children,
  initialLanguage = "en",
  initialUser = null,
}) {
  const [language, setLanguageState] = useState(initialLanguage);
  const [user, setUserState] = useState(initialUser);
  const setUser = useCallback((nextUser) => {
    setUserState((currentUser) => {
      const next = typeof nextUser === "function" ? nextUser(currentUser) : nextUser;
      if (currentUser?.id !== next?.id) clearClientCache();
      return next;
    });
  }, []);
  const [authLoaded] = useState(true);
  const [loadedLocale, setLoadedLocale] = useState(null);
  const setLanguage = useCallback((nextLanguage) => {
    if (!supportedLanguages.has(nextLanguage)) return;
    setLanguageState((currentLanguage) =>
      currentLanguage === nextLanguage ? currentLanguage : nextLanguage,
    );
    saveLanguagePreference(nextLanguage);
  }, []);

  useEffect(() => {
    if (initialUser?.language && supportedLanguages.has(initialUser.language))
      setLanguage(initialUser.language);
  }, [initialUser, setLanguage]);

  useEffect(() => {
    let cancelled = false;
    loadLocaleMessages(language)
      .then((messages) => {
        if (cancelled) return;
        setLoadedLocale({ language, messages });
      })
      .catch((error) => {
        if (!cancelled) {
          console.error(`Could not load ${language} locale messages.`, error);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const locale =
    loadedLocale?.language === language ? loadedLocale.messages : emptyLocale;
  const messages = useMemo(
    () => ({
      ...translations.en,
      ...pageTranslations.en,
      ...locale,
      ...(translations[language] || {}),
      ...(pageTranslations[language] || {}),
      discover:
        locale.discoverLabel ||
        translations[language]?.discover ||
        translations.en.discover,
    }),
    [language, locale],
  );
  const t = useMemo(() => makeTranslator(messages, locale), [messages, locale]);
  const contextValue = useMemo(
    () => ({ language, setLanguage, t, user, setUser, authLoaded }),
    [language, setLanguage, setUser, t, user, authLoaded],
  );

  return (
    <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}