"use client";

"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { PlanSelector } from "@/components/billing";
import PlatformShell from "@/components/platform-shell";
import { useLanguage } from "@/components/language-provider";

export default function SubscriptionPage() {
  const { t } = useLanguage();
  const [copyStatus, setCopyStatus] = useState("");

  async function copyTestCardNumber() {
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable.");
      }
      await navigator.clipboard.writeText("5267318187975449");
      setCopyStatus("copied");
    } catch (error) {
      console.error("Could not copy the Razorpay test card number.", error);
      setCopyStatus("error");
    }
  }

  return (
    <PlatformShell>
      <div className="page-enter mx-auto max-w-[1120px]">
        <div className="mx-auto mb-8 max-w-[570px] text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#dce5cf] bg-[#f9fbf5] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[1px] text-[#65834b]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9ac669]" />
            {t.memberships}
          </span>
          <h1 className="mt-4 text-[30px] font-semibold tracking-[-1.1px] sm:text-[36px]">
            {t.membershipHeadline}
          </h1>
          <p className="mt-2 text-[12px] leading-relaxed text-[#898f87]">
            {t.membershipDescription}
          </p>
        </div>
        <section
          aria-labelledby="test-card-title"
          className="mx-auto mb-5 max-w-[650px] rounded-2xl border-2 border-[#F9A825] bg-[#FFF9C4] px-4 py-5 text-center shadow-sm sm:px-6"
        >
          <h2
            id="test-card-title"
            className="text-sm font-extrabold text-[#5D4800] sm:text-base"
          >
            ⚠️ TEST MODE - Use Only This Test Card
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <span className="rounded-lg bg-[#FFEB3B] px-3 py-2 text-lg font-extrabold tracking-wide text-black sm:text-xl">
              5267 3181 8797 5449
            </span>
            <button
              type="button"
              onClick={copyTestCardNumber}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-[#8A6D00] bg-white px-3 text-xs font-bold text-[#5D4800] transition hover:bg-[#FFF3A0] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8A6D00]"
            >
              {copyStatus === "copied" ? <Check size={14} /> : <Copy size={14} />}
              {copyStatus === "copied" ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-3 inline-block rounded-md bg-[#FFEB3B] px-3 py-1.5 text-sm font-bold text-black">
            Expiry: 12/30 | CVV: 123
          </p>
          {copyStatus === "error" && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
              Could not copy automatically. Please copy the card number above.
            </p>
          )}
          {copyStatus === "copied" && (
            <p aria-live="polite" className="sr-only">
              Test card number copied.
            </p>
          )}
          <p className="mt-3 text-[11px] font-medium leading-relaxed text-red-700">
            Real Card / 4242 Card will fail because International Payments are
            disabled without Razorpay Approval.
          </p>
        </section>
        <PlanSelector />
        <p className="mt-5 text-center text-[10px] text-[#969d93]">
          {t.allPaidRenewMonthly}
        </p>
      </div>
    </PlatformShell>
  );
}