import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Subscription } from "@/lib/models";
import { activatePaidSubscription } from "@/lib/subscription-billing";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, [
      "razorpay_order_id",
      "razorpay_payment_id",
      "razorpay_signature",
    ]);
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret)
      throw Object.assign(new Error("Payment verification is not configured."), {
        status: 503,
      });
    const digest = crypto
      .createHmac("sha256", secret)
      .update(`${body.razorpay_order_id}|${body.razorpay_payment_id}`)
      .digest();
    const supplied = Buffer.from(body.razorpay_signature, "hex");
    if (
      digest.length !== supplied.length ||
      !crypto.timingSafeEqual(digest, supplied)
    ) {
      console.error("[payment/verify] signature verification failed", {
        orderId: body.razorpay_order_id,
        paymentId: body.razorpay_payment_id,
      });
      throw Object.assign(new Error("Payment signature is invalid."), {
        status: 400,
      });
    }
    await connectDB();
    const subscription = await Subscription.findOne({
      $or: [{ userId: user._id }, { user: user._id }],
      razorpayOrderId: body.razorpay_order_id,
    });
    if (!subscription)
      throw Object.assign(new Error("No subscription matches this order."), {
        status: 404,
      });
    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: secret,
    });
    const payment = await razorpay.payments.fetch(body.razorpay_payment_id);
    console.info("[payment/verify] gateway response", {
      paymentId: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      captured: payment.captured,
    });
    if (
      payment.id !== body.razorpay_payment_id ||
      payment.order_id !== body.razorpay_order_id ||
      payment.currency !== "INR"
    )
      throw Object.assign(
        new Error("Payment details do not match this plan order."),
        { status: 402 },
      );
    if (payment.status !== "captured") {
      if (payment.status === "failed")
        return NextResponse.json({ ok: false, status: "failed" });
      return NextResponse.json(
        { ok: false, status: "processing" },
        { status: 202 },
      );
    }
    const invoice = await activatePaidSubscription(payment);
    revalidatePath("/billing");
    revalidatePath("/subscription");
    revalidatePath("/settings/billing");
    revalidatePath("/dashboard/subscription");
    return NextResponse.json({
      ok: true,
      invoiceNumber: invoice.invoiceNumber,
      invoiceUrl: invoice.pdfUrl,
    });
  } catch (error) {
    if (error.code === "INVOICE_EMAIL_FAILED") {
      console.error("[payment/verify] payment activated; invoice email failed", {
        message: error.message,
      });
      revalidatePath("/billing");
      revalidatePath("/subscription");
      revalidatePath("/settings/billing");
      revalidatePath("/dashboard/subscription");
      return NextResponse.json({ ok: true, emailPending: true });
    }
    console.error("[payment/verify] failed", {
      name: error.name,
      message: error.message,
      status: error.status || error.statusCode,
      code: error.code,
    });
    return errorResponse(error);
  }
}
