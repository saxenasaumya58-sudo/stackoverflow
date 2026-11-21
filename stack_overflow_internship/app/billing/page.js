"use client";

import { SubscriptionDashboard } from "@/components/billing";
import PlatformShell from "@/components/platform-shell";
import { useLanguage } from "@/components/language-provider";

export default function BillingPage() {
  const { t } = useLanguage();
  return (
    <PlatformShell>
      <section aria-label={t.billingMembership} role="region">
        <SubscriptionDashboard />
      </section>
    </PlatformShell>
  );
}
