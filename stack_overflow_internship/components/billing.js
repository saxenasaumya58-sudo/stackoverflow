"use client";

import Script from "next/script";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  CreditCard,
  Crown,
  Gem,
  LogOut,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { plans } from "@/lib/plans";
import { translateServerMessage, useLanguage } from "@/components/language-provider";
import { notifyServerLogout } from "@/lib/client-auth";

const icons = { free: ShieldCheck, bronze: Sparkles, silver: Gem, gold: Crown };
const pendingPaymentStorageKey = "commons:pending-payment:v1";

export function PlanSelector() {
  const { t } = useLanguage();
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [message, setMessage] = useState("");
  const paymentVerificationInProgress = useRef(false);
  const completePayment = useCallback(() => {
    try {
      sessionStorage.removeItem(pendingPaymentStorageKey);
    } catch (error) {
      console.warn("Could not clear the pending payment details.", error);
    }
    router.push("/billing");
  }, [router]);
  const verifyPayment = useCallback(
    async (payment) => {
      if (paymentVerificationInProgress.current) return;
      paymentVerificationInProgress.current = true;
      setVerifyingPayment(true);
      setMessage("");

      try {
        for (let attempt = 0; attempt < 6; attempt += 1) {
          try {
            const response = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payment),
            });
            const result = await response.json().catch(() => ({}));
            console.info("[payment] verification result", {
              httpStatus: response.status,
              paymentId: payment.razorpay_payment_id,
              status: result.status || (result.ok ? "captured" : "unknown"),
            });

            if (response.ok && result.ok) {
              completePayment();
              return;
            }

            const statusResponse = await fetch("/api/subscription/status", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                paymentId: payment.razorpay_payment_id,
              }),
            });
            const paymentStatus = await statusResponse.json().catch(() => ({}));
            console.info("[payment] subscription status sync", {
              httpStatus: statusResponse.status,
              paymentId: payment.razorpay_payment_id,
              paymentStatus: paymentStatus.paymentStatus || "unknown",
              subscriptionStatus:
                paymentStatus.subscriptionStatus || "unknown",
            });
            if (
              statusResponse.ok &&
              paymentStatus.paymentStatus === "captured" &&
              paymentStatus.subscriptionStatus === "active"
            ) {
              completePayment();
              return;
            }
            if (
              statusResponse.ok &&
              paymentStatus.paymentStatus === "failed"
            ) {
              try {
                sessionStorage.removeItem(pendingPaymentStorageKey);
              } catch (error) {
                console.warn("Could not clear the failed payment details.", error);
              }
              setMessage(t("billing.payment_failed"));
              setVerifyingPayment(false);
              return;
            }
            if (
              !statusResponse.ok &&
              statusResponse.status >= 400 &&
              statusResponse.status < 500
            ) {
              console.error("[payment] status sync was rejected", {
                httpStatus: statusResponse.status,
                paymentId: payment.razorpay_payment_id,
                error: paymentStatus.error,
              });
              setVerifyingPayment(false);
              setMessage(t.requestFailed);
              return;
            }
          } catch (error) {
            console.error("[payment] verification request failed", {
              paymentId: payment.razorpay_payment_id,
              message: error.message,
            });
          }

          if (attempt < 5)
            await new Promise((resolve) => setTimeout(resolve, 1500));
        }

        console.info("[payment] verification remains pending", {
          paymentId: payment.razorpay_payment_id,
        });
      } finally {
        paymentVerificationInProgress.current = false;
      }
    },
    [completePayment, t],
  );

  useEffect(() => {
    let pendingPayment;
    try {
      pendingPayment = JSON.parse(
        sessionStorage.getItem(pendingPaymentStorageKey) || "null",
      );
    } catch (error) {
      console.warn("Could not read the pending payment details.", error);
      return;
    }

    if (
      pendingPayment?.payment?.razorpay_order_id &&
      pendingPayment.payment.razorpay_payment_id &&
      pendingPayment.payment.razorpay_signature
    ) {
      console.info("[payment] retrying pending verification on page load", {
        paymentId: pendingPayment.payment.razorpay_payment_id,
      });
      verifyPayment(pendingPayment.payment);
    }
  }, [verifyPayment]);

  const planCards = useMemo(
    () =>
      plans.map((plan) => ({
        ...plan,
        Icon: icons[plan.slug],
        featured: plan.slug === "silver",
      })),
    [],
  );
  async function buy(plan) {
    if (!plan.price) {
      window.location.href = "/register";
      return;
    }
    setBusy(plan.slug);
    setMessage("");
    try {
      const response = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: plan.slug }),
      });
      const order = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(
            translateServerMessage(response.status, t),
        );
      if (!window.Razorpay)
        throw new Error(
          t.checkoutUnavailable,
        );
      const checkout = new window.Razorpay({
        key: order.key,
        amount: order.amount,
        currency: order.currency,
        name: t.productName || "Commons",
        description: `${t.planNames[plan.slug]} ${t.membershipLabel}`,
        order_id: order.orderId,
        prefill: order.prefill,
        theme: { color: "#293b29" },
        handler: async (payment) => {
          try {
            sessionStorage.setItem(
              pendingPaymentStorageKey,
              JSON.stringify({ payment }),
            );
          } catch (error) {
            console.warn("Could not save the pending payment details.", error);
          }
          verifyPayment(payment);
        },
      });
      checkout.on("payment.failed", (event) => {
        console.info("[payment] gateway reported a failed attempt", {
          code: event?.error?.code,
          reason: event?.error?.reason,
        });
        setMessage(t("billing.payment_failed"));
      });
      checkout.open();
    } catch {
      setMessage(t.requestFailed);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
      />
      {message && (
        <p
          role="alert"
          className="mb-4 rounded-lg border border-[#f2c6b7] bg-[#fff2ed] px-4 py-3 text-[12px] text-[#98432b]"
        >
          {message}
        </p>
      )}
      {verifyingPayment && (
        <p
          role="status"
          aria-live="polite"
          className="mb-4 rounded-lg border border-[#dce5cf] bg-[#f9fbf5] px-4 py-3 text-[12px] text-[#526f3a]"
        >
          {t("billing.verifying_payment")}
        </p>
      )}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {planCards.map((plan) => {
          const { Icon, featured } = plan;
          const planName = t.planNames[plan.slug];
          return (
            <article
              key={plan.slug}
              className={`relative flex min-h-[385px] flex-col rounded-xl border p-5 transition hover:-translate-y-1 hover:shadow-lg ${featured ? "border-[#b7d584] bg-[#fbfff4] shadow-[0_5px_22px_#8fae4d18]" : "border-[#e3e5dd] bg-[#fbfbf8]"}`}
            >
              {featured && (
                <span className="absolute right-4 top-4 rounded-full bg-[#dff0c3] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.8px] text-[#527036]">
                  {t.mostLoved}
                </span>
              )}
              <span
                className={`grid h-10 w-10 place-items-center rounded-xl ${plan.slug === "gold" ? "bg-[#f4e6ad] text-[#846b16]" : plan.slug === "silver" ? "bg-[#e5eadf] text-[#596d50]" : plan.slug === "bronze" ? "bg-[#f4e0d2] text-[#a36a42]" : "bg-[#eceee8] text-[#777e72]"}`}
              >
                <Icon size={19} />
              </span>
              <h2 className="mt-5 text-[16px] font-semibold">
                {planName}
              </h2>
              <p className="mt-1 text-[11px] text-[#8e958c]">
                {plan.slug === "free"
                  ? t.freePlanDescription
                  : plan.slug === "gold"
                    ? t.goldPlanDescription
                    : plan.slug === "bronze"
                      ? t.bronzePlanDescription
                      : t.silverPlanDescription}
              </p>
              <p className="mt-5 flex items-baseline gap-1">
                <span className="text-[29px] font-semibold tracking-[-1.5px]">
                  ₹{plan.price}
                </span>
                <span className="text-[10px] text-[#929990]">
                  {plan.price ? t.monthly : t.forever}
                </span>
              </p>
              <div className="my-4 h-px bg-[#e9ebe3]" />
              <ul className="flex-1 space-y-3">
                {t.planFeatures[plan.slug].map(
                  (feature) => (
                    <li
                      key={feature}
                      className="flex gap-2 text-[11px] leading-relaxed text-[#596159]"
                    >
                      <Check
                        size={14}
                        className="mt-px shrink-0 text-[#6c9141]"
                      />
                      {feature}
                    </li>
                  ),
                )}
              </ul>
              <button
                onClick={() => buy(plan)}
                disabled={!!busy || verifyingPayment}
                className={`mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-lg text-[11px] font-semibold transition ${featured ? "bg-[#293b29] text-white hover:bg-[#3b5738]" : "border border-[#dfe2d9] bg-white text-[#414940] hover:border-[#afbba0]"}`}
              >
                {busy === plan.slug
                  ? t.preparingCheckout
                  : plan.price
                    ? t.choosePlan
                    : t.getStarted}
                {!busy && <BadgeCheck size={14} />}
              </button>
            </article>
          );
        })}
      </div>
    </>
  );
}

export function SubscriptionDashboard() {
  const { t, setUser } = useLanguage();
  const router = useRouter();
  const [invoices, setInvoices] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const requestId = useRef(0);
  function logout() {
    setUser(null);
    router.replace("/login");
    notifyServerLogout();
  }
  const refreshSubscription = useCallback(async () => {
    const currentRequestId = ++requestId.current;
    try {
      const response = await fetch("/api/subscription", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Subscription request failed (${response.status}).`);
      }
      const data = await response.json();
      if (currentRequestId !== requestId.current) return;
      setInvoices(data);
      setLoadError(false);
    } catch (error) {
      if (currentRequestId !== requestId.current) return;
      console.error("Could not load subscription details.", error);
      setLoadError(true);
    } finally {
      if (currentRequestId === requestId.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshSubscription();

    return () => {
      requestId.current += 1;
    };
  }, [refreshSubscription]);

  if (loading) {
    return (
      <div
        aria-label={t.loading}
        aria-busy="true"
        className="mx-auto max-w-[900px] animate-pulse space-y-5"
      >
        <div className="h-20 rounded-xl bg-[#e8e9e2]" />
        <div className="h-56 rounded-xl bg-[#e8e9e2]" />
        <div className="h-48 rounded-xl bg-[#e8e9e2]" />
      </div>
    );
  }

  if (loadError && !invoices) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-[900px] rounded-xl border border-[#f2c6b7] bg-[#fff2ed] p-5 text-[12px] text-[#98432b]"
      >
        {t.requestFailed}
      </div>
    );
  }

  const current = invoices?.subscription;
  const isActive = Boolean(
    invoices?.billingStatus?.isActive ||
      (current?.status === "active" && current.plan?.slug !== "free"),
  );
  const displayPlan = isActive ? current.plan : null;
  return (
    <div className="page-enter mx-auto max-w-[900px]">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">
            {t.yourAccount}
          </p>
          <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">
            {t("billing.title")}
          </h1>
          <p className="mt-1 text-[12px] text-[#8c938b]">
            {t.billingIntro}
          </p>
        </div>
        <button
          onClick={logout}
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#e1e4dc] bg-white px-3 text-[11px] font-medium text-[#596159] hover:bg-[#f1f2ed]"
        >
          <LogOut size={14} />
          {t.logout}
        </button>
      </div>
      <section className="rounded-xl border border-[#e5e7df] bg-[#fbfbf8] p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#e9f0de] text-[#526f3a]">
              <Crown size={19} />
            </span>
            <div>
              <p className="text-[10px] uppercase tracking-[1px] text-[#949b92]">
                {t("billing.plan")}
              </p>
              <h2 className="mt-1 text-[17px] font-semibold">
                {displayPlan?.name || t.freeMembership}
              </h2>
            </div>
          </div>
          <span
            className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${isActive ? "bg-[#e8f2de] text-[#54753d]" : "bg-[#f0f1eb] text-[#777e72]"}`}
          >
            {isActive ? t.active : t("billing.no_subscription")}
          </span>
        </div>
        <div className="mt-6 grid gap-4 border-t border-[#e8e9e2] pt-5 sm:grid-cols-3">
          <div>
            <p className="text-[10px] text-[#969d94]">{t("billing.monthly_total")}</p>
            <p className="mt-1 text-[14px] font-semibold">
              ₹{displayPlan?.price || 0}{" "}
              <span className="text-[10px] font-normal text-[#999f96]">
                {t.currencyPerMonth}
              </span>
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#969d94]">{t("billing.renewal")}</p>
            <p className="mt-1 text-[13px] font-medium">
              {current?.renewalDate
                ? new Date(current.renewalDate).toLocaleDateString()
                : t("billing.no_renewal")}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-[#969d94]">{t("billing.billing_details")}</p>
            <p className="mt-1 text-[12px] font-medium">
              {current?.billingDetails?.name ||
                invoices?.email ||
                t.signInBilling}
            </p>
            {current?.billingDetails?.email && <p className="text-[10px] text-[#858d82]">{current.billingDetails.email}</p>}
            {current?.billingDetails?.address && <p className="text-[10px] text-[#858d82]">{current.billingDetails.address}</p>}
          </div>
        </div>
        <a
          href="/subscription"
          className="mt-6 inline-flex h-9 items-center rounded-lg bg-[#293b29] px-4 text-[11px] font-semibold text-white hover:bg-[#3b5738]"
        >
          {isActive ? t.explorePlans : t.subscribe}
        </a>
      </section>
      <section className="mt-7 overflow-hidden rounded-xl border border-[#e5e7df] bg-[#fbfbf8]">
        <div className="flex items-center justify-between border-b border-[#e8e9e2] px-5 py-4">
          <div>
            <h2 className="text-[13px] font-semibold">{t("billing.invoice_history")}</h2>
            <p className="mt-1 text-[10px] text-[#979d94]">
              {t("billing.receipts")}
            </p>
          </div>
            <span className="rounded border border-[#e7e9e1] px-2 py-1 text-[9px] uppercase tracking-[.7px] text-[#858d82]">
              {t.currencyCode}
          </span>
        </div>
        <div className="divide-y divide-[#eff0eb]">
          {(invoices?.invoices || []).length ? (
            invoices.invoices.map((invoice) => (
              <div
                key={invoice._id}
                className="flex flex-wrap items-center gap-3 px-5 py-4"
              >
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f0f1eb] text-[#858d82]">
                  <CreditCard size={15} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-medium">
                    {t.planNames?.[invoice.plan] || t.invoiceMembership} {t.invoiceMembership}
                  </span>
                  <span className="mt-1 block text-[10px] text-[#9aa097]">
                    {invoice.invoiceId} ·{" "}
                    {new Date(invoice.paidAt).toLocaleDateString()}
                  </span>
                </span>
                <span className="text-[12px] font-semibold">
                  ₹{invoice.amount}
                </span>
                <a
                  href={`/api/invoices/${invoice._id}`}
                  download={`${invoice.invoiceNumber || invoice.invoiceId || "invoice"}.pdf`}
                  className="rounded-md border border-[#e1e4dc] px-3 py-1.5 text-[10px] font-medium hover:bg-[#f1f2ed]"
                >
                  {t("billing.download_invoice")}
                </a>
              </div>
            ))
          ) : (
            <div className="px-5 py-9 text-center text-[11px] text-[#9da39a]">
              {invoices === null
                ? t.signInHistory
                : t("billing.no_payments")}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
