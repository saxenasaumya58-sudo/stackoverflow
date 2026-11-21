"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Mail, ShieldCheck } from "lucide-react";
import { languages } from "@/lib/plans";
import { translateServerMessage, useLanguage } from "@/components/language-provider";

function authErrorMessage(response, result, messages) {
  if (
    (response.status < 500 || response.status === 503) &&
    typeof result?.error === "string"
  )
    return result.error;
  return translateServerMessage(response.status, messages);
}

export function ForgotPasswordForm() {
  const [identifier, setIdentifier] = useState("");
  const [mobile, setMobile] = useState("");
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [developmentPassword, setDevelopmentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [needsMobile, setNeedsMobile] = useState(false);
  const { t } = useLanguage();
  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, ...(needsMobile ? { mobile } : {}) }),
    });
    const result = await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      setError(
        response.status < 500 && typeof result.error === "string"
          ? result.error
          : translateServerMessage(response.status, t, {
              rateLimitKey: "forgotPasswordDailyLimit",
            }),
      );
    else if (result.requiresMobile) {
      setNeedsMobile(true);
      setMessage(
        "Your mobile number is not registered on your account. Please enter your mobile number once.",
      );
    } else {
      setMessage(t.forgotPasswordRequestSent);
      setSent(true);
      setNeedsMobile(false);
      if (result.developmentCredentials) {
        setDevelopmentPassword(
          result.developmentCredentials.temporaryPassword || "",
        );
        setToken(result.developmentCredentials.token || "");
      }
    }
  }
  async function verifyToken(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const response = await fetch("/api/auth/forgot-password/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, token }),
    });
    await response.json().catch(() => ({}));
    setBusy(false);
    if (!response.ok)
      setError(
        translateServerMessage(response.status, t, {
          rateLimitKey: "forgotPasswordDailyLimit",
        }),
      );
    else {
      setMessage(t.passwordResetSuccess);
      setSent(false);
      setToken("");
    }
  }
  return (
    <form onSubmit={sent ? verifyToken : submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-[11px] font-medium text-[#535c52]">
          {t.emailAddress} / {t.mobileNumber}
        </span>
        <input
          required
          disabled={sent || needsMobile}
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          autoComplete="username"
          className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
          placeholder={t.emailOrPhonePlaceholder}
        />
      </label>
      {needsMobile && !sent && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#535c52]">
            {t.mobileNumber}
          </span>
          <input
            required
            type="tel"
            inputMode="numeric"
            pattern="[6-9][0-9]{9}"
            maxLength={10}
            autoComplete="tel"
            value={mobile}
            onChange={(event) =>
              setMobile(event.target.value.replace(/\D/g, "").slice(0, 10))
            }
            className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
            placeholder="9876543210"
          />
        </label>
      )}
      {sent && (
        <label className="block">
          <span className="mb-1.5 block text-[11px] font-medium text-[#535c52]">
            {t.resetToken}
          </span>
          <input
            required
            autoComplete="one-time-code"
            value={token}
            onChange={(event) => setToken(event.target.value.trim())}
            className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
          />
        </label>
      )}
      {error && (
        <p
          role="alert"
          className="rounded-md bg-[#fff0eb] px-3 py-2.5 text-[11px] text-[#994b36]"
        >
          {error}
        </p>
      )}
      {message && (
        <p
          role="status"
          className="rounded-md bg-[#edf4e5] px-3 py-2.5 text-[11px] text-[#55743b]"
        >
          {message}
        </p>
      )}
      {developmentPassword && (
        <p
          role="status"
          className="rounded-md border border-[#e5d9a8] bg-[#fffbea] px-3 py-2.5 text-[11px] text-[#695c25]"
        >
          {t.developmentTemporaryPassword}{" "}
          <strong className="select-all font-mono">{developmentPassword}</strong>
          <br />
          {t.resetTokenAutoFilled}
        </p>
      )}
      <button
        disabled={busy}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#293b29] text-[12px] font-semibold text-white hover:bg-[#3b5738] disabled:opacity-60"
      >
        {busy ? t.sendingSecurely : sent ? t.verifyContinue : t.resetPassword}
        <ArrowRight size={15} />
      </button>
      <p className="text-[10px] leading-relaxed text-[#959c93]">
        {t.oncePerDayNotice}
      </p>
    </form>
  );
}

export function AuthForm({ mode = "login" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsOtp, setNeedsOtp] = useState("");
  const [otp, setOtp] = useState("");
  const [otpDestination, setOtpDestination] = useState("");
  const [phone, setPhone] = useState("");
  const [phoneOtp, setPhoneOtp] = useState("");
  const [phoneOtpInput, setPhoneOtpInput] = useState("");
  const [phoneOtpSent, setPhoneOtpSent] = useState(false);
  const [phoneOtpVerified, setPhoneOtpVerified] = useState(false);
  const [trusted, setTrusted] = useState(false);
  const { setUser, t } = useLanguage();

  async function sendPhoneOtp() {
    setBusy(true);
    setError("");
    setPhoneOtp("");
    setPhoneOtpSent(false);
    setPhoneOtpVerified(false);
    setPhoneOtpInput("");
    try {
      const response = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: phone }),
      });
      const result = await response.json();
      if (!response.ok || !/^\d{4}$/.test(String(result.otp))) {
        setError(result.error || translateServerMessage(response.status, t));
        return;
      }
      setPhoneOtp(result.otp);
      setPhoneOtpSent(true);
    } catch (requestError) {
      console.error("Test phone OTP request failed:", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function verifyPhoneOtp() {
    setBusy(true);
    setError("");
    setPhoneOtpVerified(false);
    try {
      const response = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: phone, otp: phoneOtpInput }),
      });
      const result = await response.json();
      if (!response.ok || result.verified !== true) {
        setError(result.error || translateServerMessage(response.status, t));
        return;
      }
      setPhoneOtpVerified(true);
    } catch (requestError) {
      console.error("Test phone OTP verification failed:", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const form = new FormData(event.currentTarget);
      const payload = Object.fromEntries(form.entries());
      if (mode === "login") {
        payload.trusted = trusted;
      }
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(authErrorMessage(response, result, t));
        return;
      }
      if (result.requiresOtp) {
        setNeedsOtp(result.challengeId);
        setOtpDestination(result.destination || "");
        return;
      }
      if (result.user) setUser(result.user);
      router.replace(mode === "login" ? "/feed" : "/settings/language");
    } catch (requestError) {
      console.error("Authentication request failed:", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }
  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/verify-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: needsOtp, otp }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(authErrorMessage(response, result, t));
        return;
      }
      if (result.user) setUser(result.user);
      router.replace(mode === "login" ? "/feed" : "/settings/language");
    } catch (requestError) {
      console.error("Device verification request failed:", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }
  async function resendVerificationCode() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/resend-device-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challengeId: needsOtp }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(authErrorMessage(response, result, t));
        return;
      }
      setOtp("");
      setOtpDestination(result.destination || otpDestination);
    } catch (requestError) {
      console.error("Device verification resend failed:", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      {needsOtp ? (
        <form onSubmit={verify} className="mt-6 space-y-4">
          <div className="rounded-lg bg-[#edf4e5] p-3 text-[11px] text-[#536e3c]">
            {t.verificationCodeSent}
            {otpDestination && (
              <span className="mt-1 block font-medium">{otpDestination}</span>
            )}
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium">
              {t.sixDigitCode}
            </span>
            <input
              autoFocus
              required
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, ""))
              }
              className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-center text-[17px] tracking-[6px] outline-none focus:border-[#91ad71]"
            />
          </label>
          {error && (
            <p role="alert" className="text-[11px] text-[#994b36]">
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="h-11 w-full rounded-lg bg-[#293b29] text-[12px] font-semibold text-white"
          >
            {busy ? t.verifying : t.verifyContinue}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={resendVerificationCode}
            className="h-9 w-full rounded-lg text-[11px] text-[#727a70] disabled:opacity-50"
          >
            {t.resendOtp}
          </button>
        </form>
      ) : (
        <form onSubmit={submit} autoComplete="off" className="mt-6 space-y-4">
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-medium">
                {t.fullName}
              </span>
              <input
                name="name"
                required
                minLength={2}
                autoComplete="off"
                className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
                placeholder={t.yourName}
              />
            </label>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium">
              {t.emailAddress}
            </span>
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
              placeholder={
                mode === "login" ? "Enter your email" : t.emailPlaceholder
              }
            />
          </label>
          {mode === "register" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-medium">
                  {t.mobileNumber} <span aria-hidden="true" className="text-[#994b36]">*</span>
                </span>
                <input
                  name="mobile"
                  type="tel"
                  inputMode="numeric"
                  required
                  pattern="[6-9][0-9]{9}"
                  maxLength={10}
                  autoComplete="off"
                  value={phone}
                  onChange={(event) => {
                    setPhone(event.target.value.replace(/\D/g, "").slice(0, 10));
                    setPhoneOtp("");
                    setPhoneOtpInput("");
                    setPhoneOtpSent(false);
                    setPhoneOtpVerified(false);
                  }}
                  className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
                  placeholder="9876543210"
                />
              </label>
              {process.env.NODE_ENV !== "production" && (
                <>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={sendPhoneOtp}
                    className="mt-2 text-[11px] font-semibold text-[#628044] hover:underline disabled:opacity-60"
                  >
                    {busy ? t.sendingCode : t.sendTestOtp}
                  </button>
                  {phoneOtpSent && (
                    <div className="mt-3 space-y-3 rounded-lg border border-[#e1e4db] bg-white p-3">
                      <p className="text-[11px] text-[#536e3c]" role="status">
                        {t.testOtpSent}{" "}
                        <strong className="select-all font-mono">{phoneOtp}</strong>
                      </p>
                      <label className="block">
                        <span className="mb-1.5 block text-[11px] font-medium">
                          {t.fourDigitCode}
                        </span>
                        <input
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={4}
                          value={phoneOtpInput}
                          onChange={(event) =>
                            setPhoneOtpInput(event.target.value.replace(/\D/g, ""))
                          }
                          className="h-11 w-full rounded-lg border border-[#e1e4db] px-3 text-center text-[17px] tracking-[6px] outline-none focus:border-[#91ad71]"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={verifyPhoneOtp}
                        className="text-[11px] font-semibold text-[#628044] hover:underline disabled:opacity-60"
                      >
                        {busy ? t.verifying : t.verifyOtp}
                      </button>
                      {phoneOtpVerified && (
                        <p className="text-[11px] text-[#536e3c]" role="status">
                          {t.testOtpVerified}
                        </p>
                      )}
                    </div>
                  )}
                </>
              )}
            </>
          )}
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-medium">
              {t.password}
            </span>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="off"
              className="h-11 w-full rounded-lg border border-[#e1e4db] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
              placeholder={
                mode === "login" ? "Enter your password" : t.atLeast8Characters
              }
            />
          </label>
          {mode === "login" && (
            <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[#687168]">
              <input
                type="checkbox"
                checked={trusted}
                onChange={(event) => setTrusted(event.target.checked)}
                className="accent-[#51743a]"
              />
              {t.rememberTrustedDevice}
            </label>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-md bg-[#fff0eb] px-3 py-2.5 text-[11px] text-[#994b36]"
            >
              {error}
            </p>
          )}
          <button
            disabled={busy}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#293b29] text-[12px] font-semibold text-white hover:bg-[#3b5738] disabled:opacity-60"
          >
            {busy
              ? t.pleaseWait
              : mode === "login"
                ? t.signIn
                : t.createAccount}
            <ArrowRight size={15} />
          </button>
          {mode === "login" && (
            <a
              href="/forgot-password"
              className="block text-center text-[11px] text-[#66834a] hover:underline"
            >
              {t.forgotPassword}
            </a>
          )}
        </form>
      )}
    </div>
  );
}

export function LanguageSettings({ compact = false }) {
  const { language, setLanguage, setUser, t, user, authLoaded } = useLanguage();
  const [selected, setSelected] = useState(language);
  const [current, setCurrent] = useState(language);
  const registeredMobile =
    user?.mobile || user?.phone || user?.mobileNumber || "";
  const mobileDigits = registeredMobile.replace(/\D/g, "");
  const localMobile =
    mobileDigits.length === 12 && mobileDigits.startsWith("91")
      ? mobileDigits.slice(2)
      : mobileDigits;
  const formattedRegisteredMobile = /^[6-9]\d{9}$/.test(localMobile)
    ? `+91 ${localMobile.slice(0, 5)} ${localMobile.slice(5)}`
    : registeredMobile;
  const mobileMissing = !registeredMobile;
  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [serverOtp, setServerOtp] = useState("");
  const [emailDeliveryFailed, setEmailDeliveryFailed] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [expiresAt, setExpiresAt] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setCurrent(language);
    setSelected(language);
  }, [language]);

  useEffect(() => {
    if (registeredMobile) setMobile(registeredMobile);
  }, [registeredMobile]);

  useEffect(() => {
    if (!expiresAt || !otpSent) return undefined;
    const updateRemaining = () => {
      const remaining = Math.max(
        0,
        Math.ceil((expiresAt - Date.now()) / 1000),
      );
      setSecondsRemaining(remaining);
      if (remaining === 0) setError(t.invalidOtp);
    };
    updateRemaining();
    const interval = setInterval(updateRemaining, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, otpSent, t.invalidOtp]);

  function chooseLanguage(nextLanguage) {
    if (compact && !user) {
      setLanguage(nextLanguage);
      return;
    }
    setSelected(nextLanguage);
    setError("");
    setOtp("");
    setServerOtp("");
    setEmailDeliveryFailed(false);
    setOtpSent(false);
    setExpiresAt(0);
    if (nextLanguage === current) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }

  async function sendOtp(event) {
    event?.preventDefault();
    if (!user) {
      setError(t.signInToAction);
      return;
    }
    setBusy(true);
    setError("");
    setOtp("");
    setServerOtp("");
    setEmailDeliveryFailed(false);
    setOtpSent(false);
    try {
      const emailOtp = selected === "fr";
      const response = await fetch(
        emailOtp
          ? "/api/language/send-email-otp"
          : "/api/send-mobile-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetLanguage: selected,
            ...(mobileMissing ? { mobile } : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || translateServerMessage(response.status, t));
        return;
      }
      if (result.requiresMobile) {
        setError(
          "Your mobile number is not registered on your account. Please enter your mobile number once.",
        );
        return;
      }
      if (!result.success || !result.expiresAt) {
        setError(result.error || t.requestFailed);
        return;
      }
      setError("");
      setServerOtp(
        typeof result.demoOtp === "string"
          ? result.demoOtp
          : typeof result.otp === "string"
            ? result.otp
            : "",
      );
      setEmailDeliveryFailed(emailOtp && result.deliveryFailed === true);
      setOtpSent(true);
      setExpiresAt(new Date(result.expiresAt).getTime());
      setOpen(true);
    } catch (requestError) {
      console.error("Language OTP request failed", requestError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    if (!otpSent || secondsRemaining <= 0) {
      setError(t.invalidOtp);
      setBusy(false);
      return;
    }
    try {
      const emailOtp = selected === "fr";
      const response = await fetch(
        emailOtp
          ? "/api/language/verify-email-otp"
          : "/api/verify-mobile-otp",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            targetLanguage: selected,
            otp,
            ...(!emailOtp ? { mobile } : {}),
          }),
        },
      );
      const result = await response.json();
      if (!response.ok) {
        setError(
          result.error === "Galat OTP"
            ? t.invalidOtp
            : result.error || translateServerMessage(response.status, t),
        );
        return;
      }
      setCurrent(result.language);
      setSelected(result.language);
      setLanguage(result.language);
      if (user)
        setUser({
          ...user,
          language: result.language,
          mobile: result.mobile || mobile,
          phone: result.mobile || mobile,
        });
      setOpen(false);
      setOtp("");
      setServerOtp("");
      setEmailDeliveryFailed(false);
      setOtpSent(false);
    } catch (verificationError) {
      console.error("Language OTP verification failed", verificationError);
      setError(t.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  const languageSelector = (
    <select
      aria-label={t.language}
      value={current}
      onChange={(event) => chooseLanguage(event.target.value)}
      className="h-9 max-w-[150px] rounded-lg border border-[#e6e7e0] bg-white/70 px-2 text-[11px] text-[#596159] outline-none focus:border-[#91ad71]"
    >
      {languages.map((item) => (
        <option key={item.code} value={item.code}>
          {item.native}
        </option>
      ))}
    </select>
  );
  return (
    <>
      {compact ? (
        languageSelector
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {languages.map((item) => (
              <button
                key={item.code}
                onClick={() => chooseLanguage(item.code)}
                className={`flex min-h-[78px] items-center gap-3 rounded-xl border px-4 text-left transition ${selected === item.code ? "border-[#a7c17e] bg-[#f8fbed] shadow-[0_0_0_2px_#edf4e5]" : "border-[#e5e7df] bg-[#fbfbf8] hover:border-[#cad1c0]"}`}
              >
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#eff1e9] text-[10px] font-bold tracking-[.5px] text-[#647359]">
                  {item.flag}
                </span>
                <span className="flex-1">
                  <span className="block text-[12px] font-semibold">
                    {item.native}
                  </span>
                </span>
                {current === item.code && (
                  <Check size={16} className="text-[#668744]" />
                )}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-[#858d83]">
            {selected === "fr" ? t.frenchEmailNotice : t.mobileOtpNotice}
          </p>
        </>
      )}
      {error && !open && (
        <p role="alert" className="mt-2 text-[11px] text-[#994b36]">
          {error}
        </p>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#152019]/40 p-4">
          <form
            onSubmit={otpSent ? verify : sendOtp}
            className="w-full max-w-[390px] rounded-2xl border border-[#e2e5db] bg-[#fbfbf8] p-6 shadow-2xl"
          >
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf3e4] text-[#5d793f]">
              <ShieldCheck size={17} />
            </span>
            <h2 className="mt-4 text-[17px] font-semibold">
              {selected === "fr" && !mobileMissing ? "Email OTP" : "Mobile OTP"}
            </h2>
            {mobileMissing ? (
              <>
                <p className="mt-3 text-[11px] leading-relaxed text-[#8c9389]">
                  {
                    "Your mobile number is not registered on your account. Please enter your mobile number once."
                  }
                </p>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[11px] font-medium text-[#535c52]">
                    {t.mobileNumber}
                  </span>
                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    pattern="[6-9][0-9]{9}"
                    maxLength={10}
                    autoComplete="tel"
                    disabled={otpSent}
                    value={mobile}
                    onChange={(event) =>
                      setMobile(
                        event.target.value.replace(/\D/g, "").slice(0, 10),
                      )
                    }
                    className="h-11 w-full rounded-lg border border-[#dfe3d8] bg-white px-3 text-[13px] outline-none focus:border-[#91ad71]"
                    placeholder="9876543210"
                  />
                </label>
              </>
            ) : !(otpSent && selected === "fr") ? (
              selected === "fr" ? (
                <div className="mt-3 text-[11px] text-[#8c9389]">
                  <p>OTP will be sent to your registered email address:</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#535c52]">
                    {user.email}
                  </p>
                  <p className="mt-2 text-[10px]">
                    Please click Send OTP to continue.
                  </p>
                </div>
              ) : (
                <div className="mt-3 text-[11px] text-[#8c9389]">
                  <p>OTP will be sent to your registered mobile number:</p>
                  <p className="mt-1 text-[13px] font-semibold text-[#535c52]">
                    {formattedRegisteredMobile}
                  </p>
                  <p className="mt-2 text-[10px]">
                    Please click Send OTP to continue.
                  </p>
                </div>
              )
            ) : null}
            {otpSent && (
              <>
                {selected === "fr" ? (
                  emailDeliveryFailed ? (
                    <div
                      role="status"
                      className="mt-4 rounded-lg border border-[#ead4cb] bg-[#fff7f3] p-3 text-[11px] leading-relaxed text-[#994b36]"
                    >
                      <p>
                        Demo OTP:{" "}
                        <strong className="font-mono">{serverOtp}</strong>
                      </p>
                      <p className="mt-1">
                        Email delivery failed, Demo OTP shown above
                      </p>
                    </div>
                  ) : (
                    <p
                      role="status"
                      className="mt-4 text-[11px] leading-relaxed text-[#8c9389]"
                    >
                      Sending OTP to your registered email: {user.email}
                    </p>
                  )
                ) : (
                  <p className="mt-4 text-[11px] leading-relaxed text-[#8c9389]">
                    {t.otpSentToMobile}
                  </p>
                )}
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-[11px] font-medium text-[#535c52]">
                    {t.sixDigitCode}
                  </span>
                  <input
                    required
                    autoFocus
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="one-time-code"
                    value={otp}
                    onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))}
                    className="h-12 w-full rounded-lg border border-[#dfe3d8] bg-white text-center text-[19px] tracking-[8px] outline-none focus:border-[#91ad71]"
                  />
                </label>
                {serverOtp &&
                  selected !== "fr" &&
                  process.env.NODE_ENV !== "production" && (
                  <p role="status" className="mt-2 text-center text-[11px] font-medium text-[#55743b]">
                    Your OTP is: {serverOtp}
                  </p>
                )}
                <p className="mt-2 text-[10px] text-[#858d83]">
                  {t.otpExpiresIn} {secondsRemaining}s
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="mt-2 text-[11px] text-[#994b36]">
                {error}
              </p>
            )}
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              {otpSent && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={sendOtp}
                  className="h-9 rounded-lg px-3 text-[11px] text-[#727a70] disabled:opacity-50"
                >
                  {t.resendOtp}
                </button>
              )}
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setOpen(false);
                  setSelected(current);
                  setOtp("");
                  setServerOtp("");
                  setEmailDeliveryFailed(false);
                  setOtpSent(false);
                  setExpiresAt(0);
                  setError("");
                }}
                className="h-9 rounded-lg px-3 text-[11px] text-[#727a70]"
              >
                {t.cancel}
              </button>
              <button
                disabled={
                  busy ||
                  !authLoaded ||
                  (otpSent && secondsRemaining <= 0)
                }
                type="submit"
                className="h-9 rounded-lg bg-[#293b29] px-4 text-[11px] font-semibold text-white disabled:opacity-50"
              >
                {busy
                  ? otpSent
                    ? t.verifying
                    : t.sendingCode
                  : otpSent
                    ? "Verify & Change Language"
                    : "Send OTP"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
