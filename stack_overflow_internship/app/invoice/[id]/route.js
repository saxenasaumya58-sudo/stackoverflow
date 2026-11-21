import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Invoice } from "@/lib/models";
import { createInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function GET(request, { params }) {
  try {
    const { user } = await getAuth();
    await connectDB();
    const invoice = await Invoice.findOne({
      _id: params.id,
      $or: [{ userId: user._id }, { user: user._id }],
    }).lean();
    if (!invoice)
      throw Object.assign(new Error("Invoice not found."), { status: 404 });

    const pdf = await createInvoicePdf(invoice, user);
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}