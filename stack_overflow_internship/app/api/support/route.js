import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse, requireFields } from "@/lib/http";
import { SupportTicket } from "@/lib/models";
import { getCurrentSubscription } from "@/lib/subscriptions";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    requireFields(body, ["subject", "message"]);
    const subject = String(body.subject).trim();
    const message = String(body.message).trim();
    if (!subject || subject.length > 160 || !message || message.length > 5000)
      throw Object.assign(new Error("Check the subject and message length."), {
        status: 400,
      });

    await connectDB();
    const subscription = await getCurrentSubscription(user._id);
    const priority = subscription?.plan === "gold" ? "high" : "low";
    const ticket = await SupportTicket.create({
      user: user._id,
      subject,
      message,
      priority,
    });
    return NextResponse.json({ ticket }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}