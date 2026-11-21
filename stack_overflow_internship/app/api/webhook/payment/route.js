import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { activatePaidSubscription } from "@/lib/subscription-billing";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret)
      throw Object.assign(new Error("Payment webhook is not configured."), {
        status: 503,
      });
    const rawBody = await request.text();
    const signature = request.headers.get("x-razorpay-signature") || "";
    const digest = crypto.createHmac("sha256", secret).update(rawBody).digest();
    const supplied = Buffer.from(signature, "hex");
    if (
      digest.length !== supplied.length ||
      !crypto.timingSafeEqual(digest, supplied)
    ) {
      console.error("[payment webhook] signature verification failed", {
        eventId: request.headers.get("x-razorpay-event-id"),
      });
      throw Object.assign(new Error("Webhook signature is invalid."), {
        status: 400,
      });
    }

    const event = JSON.parse(rawBody);
    if (!["payment.captured", "order.paid"].includes(event.event))
      return NextResponse.json({ ok: true, ignored: true });
    const payment = event.payload?.payment?.entity;
    if (!payment || payment.status !== "captured")
      throw Object.assign(new Error("Captured payment is missing."), {
        status: 400,
      });
    console.info("[payment webhook] gateway payment", {
      event: event.event,
      paymentId: payment.id,
      orderId: payment.order_id,
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
      captured: payment.captured,
    });
    await connectDB();
    const invoice = await activatePaidSubscription(payment);
    revalidatePath("/billing");
    revalidatePath("/subscription");
    revalidatePath("/settings/billing");
    revalidatePath("/dashboard/subscription");
    console.info("[payment webhook] processed", {
      event: event.event,
      invoiceNumber: invoice.invoiceNumber,
    });
    return NextResponse.json({
      ok: true,
      invoiceNumber: invoice.invoiceNumber,
      pdfUrl: invoice.pdfUrl,
    });
  } catch (error) {
    if (error.code === "INVOICE_EMAIL_FAILED")
      return NextResponse.json(
        { error: "Invoice email delivery failed.", emailFailed: true },
        { status: 500 },
      );
    return errorResponse(error);
  }
}