import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { resendInvoiceEmail } from "@/lib/subscription-billing";

export const runtime = "nodejs";

export async function POST(request, { params }) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const invoice = await resendInvoiceEmail(params.id, user._id);
    return NextResponse.json({
      ok: true,
      emailSent: invoice.emailSent,
      emailSentAt: invoice.emailSentAt,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
