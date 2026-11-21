"use client";

import PeopleClient from "@/components/people-client";
import { useLanguage } from "@/components/language-provider";

export default function PeoplePage() {
  const { t } = useLanguage();
  return (
    <section aria-label={t.peopleHeadline} role="region">
      <PeopleClient />
    </section>
  );
}