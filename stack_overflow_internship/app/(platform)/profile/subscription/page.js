"use client";

import { SubscriptionDashboard } from "@/components/billing";
import { useLanguage } from "@/components/language-provider";

export default function ProfileSubscriptionPage() {
  const { t } = useLanguage();
  return (
    <section aria-label={t.billingMembership} role="region">
      <SubscriptionDashboard />
    </section>
  );
}