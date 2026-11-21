import localFont from "next/font/local";
import { cookies } from "next/headers";
import "./globals.css";
import { LanguageProvider } from "@/components/language-provider";
import { getAuth } from "@/lib/auth";
import {
  defaultLocale,
  loadLocaleMessages,
  locales,
} from "@/lib/i18n/config";

export async function generateMetadata() {
  const requestedLanguage = cookies().get("lang")?.value;
  const language = locales.includes(requestedLanguage)
    ? requestedLanguage
    : defaultLocale;
  const messages = await loadLocaleMessages(language);
  return {
    title: messages.ui?.siteTitle || "Commons",
    description: messages.ui?.siteDescription || "",
  };
}

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export default async function RootLayout({ children }) {
  const auth = await getAuth({ required: false, refresh: false });
  const initialUser = auth
    ? {
        id: auth.user.id,
        name: auth.user.name,
        email: auth.user.email,
        role: auth.user.role,
        reputation: auth.user.reputation,
        language: auth.user.language,
        mobile: auth.user.mobile,
        phone: auth.user.phone,
        mobileNumber: auth.user.mobileNumber,
        bio: auth.user.bio,
        location: auth.user.location,
        website: auth.user.website,
        avatarUrl: auth.user.avatarUrl,
      }
    : null;
  const requestedLanguage = cookies().get("lang")?.value;
  const initialLanguage = locales.includes(initialUser?.language)
    ? initialUser.language
    : locales.includes(requestedLanguage)
      ? requestedLanguage
      : defaultLocale;

  return (
    <html lang={initialLanguage}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <LanguageProvider
          initialLanguage={initialLanguage}
          initialUser={initialUser}
        >
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}
