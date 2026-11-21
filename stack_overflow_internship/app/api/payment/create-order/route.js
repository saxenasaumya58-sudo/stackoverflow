import Razorpay from "razorpay";
import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { Plan, Subscription } from "@/lib/models";
import { plans } from "@/lib/plans";
export const runtime = "nodejs";
export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["plan"]);
    const keyId = process.env.RAZORPAY_KEY_ID?.trim();
    const keySecret = process.env.RAZORPAY_KEY_SECRET?.trim();
    if (!keyId || !keySecret)
      throw Object.assign(
        new Error("Razorpay keys missing in .env.local"),
        { status: 503 },
      );
    await connectDB();
    const definition = plans.find((item) => item.slug === body.plan);
    if (!definition || definition.price < 1)
      throw Object.assign(new Error("Choose a valid paid plan."), {
        status: 400,
      });
    const savedPlans = await Promise.all(
      plans.map((item) => {
        const { questionLimit, ...planFields } = item;
        return Plan.findOneAndUpdate(
          { slug: item.slug },
          {
            $setOnInsert: planFields,
            $set: { questionLimit },
          },
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }),
    );
    const plan = savedPlans.find((item) => item.slug === definition.slug);
    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });
    const order = await razorpay.orders.create({
      amount: definition.price * 100,
      currency: "INR",
      receipt: `member_${String(user._id).slice(-12)}_${Date.now()}`,
      notes: { userId: String(user._id), plan: definition.slug },
    });
    await Subscription.create({
      userId: user._id,
      user: user._id,
      plan: definition.slug,
      status: "pending",
      razorpayOrderId: order.id,
      billingDetails: {
        name: user.name,
        email: user.email,
        address: user.location || "",
      },
    });
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      key: keyId,
      prefill: {
        name: user.name,
        email: user.email,
        contact: user.phone || "",
      },
    });
  } catch (error) {
    const description =
      error?.error?.description ||
      error?.description ||
      error?.message ||
      "Could not create a payment order.";
    const status = error?.status || error?.statusCode || 500;
    console.error("[payment/create-order] failed", {
      name: error?.name,
      message: description,
      status,
      code: error?.error?.code || error?.code,
    });
    if (
      status === 401 &&
      (error?.error?.code || error?.code) === "BAD_REQUEST_ERROR" &&
      /authentication failed/i.test(description)
    )
      return NextResponse.json(
        {
          error:
            "Razorpay rejected the API credentials. Verify RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are an active matching pair from the same test or live mode.",
        },
        { status: 502 },
      );
    if (status >= 500 && status !== 503 && process.env.NODE_ENV === "production")
      return errorResponse(error);
    return NextResponse.json({ error: description }, { status });
  }
}
