"use client";

import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function Loading() {
  const { t } = useLanguage();
  return (
    <>
      <header className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
        <LanguageSwitcher compact />
      </header>
      <main
        role="status"
        aria-label={t("ui.loadingPage")}
        className="mx-auto max-w-[900px] space-y-5 px-4 py-8"
      >
        <span className="sr-only">{t("ui.loadingPage")}</span>
        <div className="skeleton h-8 w-1/3 rounded-lg" />
        <div className="skeleton h-4 w-2/3 rounded" />
        <div className="skeleton h-40 rounded-xl" />
        <div className="skeleton h-40 rounded-xl" />
      </main>
    </>
  );
}
