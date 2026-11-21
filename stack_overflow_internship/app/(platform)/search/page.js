"use client";

import { useLanguage } from "@/components/language-provider";
import SearchResults from "@/components/search-results";

export default function SearchPage({ searchParams }) {
  const { t } = useLanguage();
  return (
    <section aria-label={t.searchCommunity} role="region">
      <SearchResults initialQuery={searchParams?.q || ""} />
    </section>
  );
}