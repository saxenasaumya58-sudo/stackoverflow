import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/http";
import { setUserSuspension } from "@/lib/admin-user-suspension";

export const runtime = "nodejs";

export async function PATCH(_request, { params }) {
  try {
    const user = await setUserSuspension(params.id, false);
    return NextResponse.json({ ok: true, user });
  } catch (error) {
    return errorResponse(error);
  }
}
