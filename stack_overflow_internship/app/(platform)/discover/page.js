"use client";

import DiscoverClient from "@/components/discover-client";
import { useLanguage } from "@/components/language-provider";

export default function DiscoverPage() {
  const { t } = useLanguage();
  return (
    <section aria-label={t("discover.title")} role="region">
      <DiscoverClient />
    </section>
  );
}