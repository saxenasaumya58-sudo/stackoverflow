"use client";

import Link from "next/link";
import { useLanguage } from "@/components/language-provider";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export default function AuthLayout({ children }) {
	const { t } = useLanguage();
	return (
		<main className="relative min-h-screen bg-[#f5f5f0] px-4 py-8">
			<header className="absolute right-4 top-4 z-10 sm:right-8 sm:top-8">
				<LanguageSwitcher compact />
			</header>
			<div className="mx-auto flex max-w-[1000px] items-center justify-center gap-12 lg:min-h-[calc(100vh-64px)]">
				<aside className="hidden w-[350px] lg:block">
					<Link href="/feed" className="flex items-center gap-2 text-[19px] font-bold tracking-[-.6px]">
						<span className="grid h-8 w-8 place-items-center rounded-[11px] bg-[#c7f36b]">✳</span>
						commons<span className="text-[#80aa43]">.</span>
					</Link>
					<h1 className="mt-14 text-[36px] font-semibold leading-[1.12] tracking-[-1.2px]">
						{t.authHeadline} <span className="font-normal text-[#848e7c]">{t.authHeadlineEmphasis}</span>
					</h1>
					<p className="mt-4 text-[13px] leading-relaxed text-[#818980]">{t.authDescription}</p>
					<div className="mt-9 flex -space-x-2">
						{["MC", "AP", "LM", "NK"].map((item, index) => (
							<span key={item} className={`grid h-9 w-9 place-items-center rounded-full border-2 border-[#f5f5f0] text-[9px] font-bold ${["bg-[#f0d4c1] text-[#71482f]", "bg-[#d9e6c2] text-[#405831]", "bg-[#d8e2f4] text-[#43587f]", "bg-[#f2e5ab] text-[#6d5d19]"][index]}`}>{item}</span>
						))}
					</div>
					<p className="mt-3 text-[10px] text-[#959c93]">{t.communityProof}</p>
				</aside>
				{children}
			</div>
		</main>
	);
}