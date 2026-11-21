import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await getAuth();
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        role: user.role,
        reputation: user.reputation,
        language: user.language,
        email: user.email,
        mobile: user.mobile,
        phone: user.phone,
        mobileNumber: user.mobileNumber,
      },
    });
  } catch (error) {
    if (error.status === 401)
      return NextResponse.json({ user: null }, { headers: { "Cache-Control": "private, no-store" } });
    return errorResponse(error);
  }
}
