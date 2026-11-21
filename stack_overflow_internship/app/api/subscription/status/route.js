import Razorpay from "razorpay";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Subscription } from "@/lib/models";
import { activatePaidSubscription } from "@/lib/subscription-billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["paymentId"]);
    if (typeof body.paymentId !== "string" || !/^pay_[a-zA-Z0-9]+$/.test(body.paymentId))
      throw Object.assign(new Error("Payment ID is invalid."), { status: 400 });

    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret)
      throw Object.assign(new Error("Payment status is not configured."), {
        status: 503,
      });

    await connectDB();
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    const payment = await razorpay.payments.fetch(body.paymentId);
    if (payment.id !== body.paymentId)
      throw Object.assign(new Error("Gateway payment ID does not match."), {
        status: 402,
      });
    console.info("[subscription/status] gateway response", {
      paymentId: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      captured: payment.captured,
    });

    const subscription = await Subscription.findOne({
      $or: [{ userId: user._id }, { user: user._id }],
      razorpayOrderId: payment.order_id,
    });
    if (!subscription)
      throw Object.assign(new Error("No subscription matches this payment."), {
        status: 404,
      });

    if (payment.status !== "captured") {
      return NextResponse.json({
        ok: true,
        paymentStatus: payment.status,
        subscriptionStatus: subscription.status,
      });
    }
    if (payment.currency !== "INR")
      throw Object.assign(new Error("Payment currency does not match."), {
        status: 402,
      });

    const invoice = await activatePaidSubscription(payment);
    revalidatePath("/billing");
    revalidatePath("/subscription");
    revalidatePath("/settings/billing");
    revalidatePath("/dashboard/subscription");
    return NextResponse.json({
      ok: true,
      paymentStatus: payment.status,
      subscriptionStatus: "active",
      invoiceNumber: invoice.invoiceNumber,
    });
  } catch (error) {
    if (error.code === "INVOICE_EMAIL_FAILED") {
      console.error(
        "[subscription/status] payment activated; invoice email failed",
      );
      revalidatePath("/billing");
      revalidatePath("/subscription");
      revalidatePath("/settings/billing");
      revalidatePath("/dashboard/subscription");
      return NextResponse.json({
        ok: true,
        paymentStatus: "captured",
        subscriptionStatus: "active",
        emailPending: true,
      });
    }
    console.error("[subscription/status] failed", {
      name: error.name,
      message: error.message,
      status: error.status || error.statusCode,
      code: error.code,
    });
    return errorResponse(error);
  }
}
