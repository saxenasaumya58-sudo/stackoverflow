"use client";

import { Globe2, ShieldCheck } from "lucide-react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import PlatformShell from "@/components/platform-shell";
import { useLanguage } from "@/components/language-provider";

export default function LanguagePage() {
  const { t } = useLanguage();
  return (
    <PlatformShell>
      <div className="page-enter mx-auto max-w-[900px]">
        <div className="mb-7">
          <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">
            {t.preferences}
          </p>
          <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">
            {t.languageRegion}
          </h1>
          <p className="mt-1 text-[12px] text-[#8c938b]">
            {t.chooseLanguage}
          </p>
        </div>
        <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#dce5cf] bg-[#f7faf2] p-4">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#e6eedb] text-[#638048]">
            <ShieldCheck size={16} />
          </span>
          <p className="pt-0.5 text-[11px] leading-relaxed text-[#65735a]">
            {t.secureLanguageChange}
          </p>
        </div>
        <LanguageSwitcher />
        <div className="mt-5 flex items-center gap-2 text-[10px] text-[#a0a69d]">
          <Globe2 size={13} />
          {t.translationNote}
        </div>
      </div>
    </PlatformShell>
  );
}