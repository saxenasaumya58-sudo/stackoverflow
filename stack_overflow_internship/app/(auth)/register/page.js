"use client";

import Link from "next/link";
import { AuthForm } from "@/components/account-forms";
import { useLanguage } from "@/components/language-provider";

export default function RegisterPage() {
	const { t } = useLanguage();
	return (
		<section className="page-enter w-full max-w-[400px] rounded-2xl border border-[#e4e6de] bg-[#fbfbf8] p-6 shadow-[0_8px_30px_#1b241408] sm:p-8">
			<p className="text-[10px] font-semibold uppercase tracking-[1px] text-[#80916b]">{t.joinCommunity}</p>
			<h2 className="mt-2 text-[23px] font-semibold tracking-[-.7px]">{t.registerHeadline}</h2>
			<p className="mt-1 text-[11px] text-[#8e958c]">{t.registerDescription}</p>
			<AuthForm mode="register" />
			<p className="mt-6 border-t border-[#eceee7] pt-5 text-center text-[11px] text-[#8c938a]">
				{t.alreadyMember} <Link href="/login" className="font-semibold text-[#628044] hover:underline">{t.signIn}</Link>
			</p>
		</section>
	);
}