import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Invoice } from "@/lib/models";
import { plans } from "@/lib/plans";
import { getBillingStatus } from "@/lib/subscriptions";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const [billingStatus, invoices] = await Promise.all([
      getBillingStatus(user._id),
      Invoice.find({
        $or: [{ userId: user._id }, { user: user._id }],
      })
        .sort({ date: -1 })
        .lean(),
    ]);
    const current = billingStatus.subscription;
    const plan = plans.find((item) => item.slug === current?.plan) || plans[0];
    const subscription = current ? { ...current, plan } : null;
    const invoiceHistory = invoices.map((invoice) => ({
      ...invoice,
      pdfUrl: `/api/invoices/${invoice._id}`,
      downloadUrl: `/api/invoices/${invoice._id}`,
    }));
    return NextResponse.json({
      billingStatus,
      subscription,
      invoices: invoiceHistory,
      email: user.email,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
