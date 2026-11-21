"use client";

import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { ForgotPasswordForm } from "@/components/account-forms";
import { useLanguage } from "@/components/language-provider";

export default function ForgotPasswordPage() {
	const { t } = useLanguage();
	return (
		<div className="page-enter mx-auto max-w-[480px] pt-7">
			<Link href="/login" className="inline-flex items-center gap-1.5 text-[11px] text-[#80877e] hover:text-[#44533d]"><ArrowLeft size={14} />{t.backToSignIn}</Link>
			<div className="mt-6 rounded-2xl border border-[#e4e6de] bg-[#fbfbf8] p-6 shadow-[0_8px_30px_#1b241408] sm:p-8">
				<span className="grid h-11 w-11 place-items-center rounded-xl bg-[#eaf0e1] text-[#5c793e]"><LockKeyhole size={19} /></span>
				<h1 className="mt-5 text-[23px] font-semibold tracking-[-.7px]">{t.getBackIn}</h1>
				<p className="mt-2 text-[12px] leading-relaxed text-[#858d84]">{t.resetInstructions}</p>
				<ForgotPasswordForm />
			</div>
		</div>
	);
}