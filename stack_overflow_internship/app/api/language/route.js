import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { errorResponse } from "@/lib/http";
import { languages } from "@/lib/plans";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await getAuth();
    const language = user.preferredLanguage || user.language;
    return NextResponse.json({
      language: languages.some((item) => item.code === language) ? language : "en",
    });
  } catch (error) {
    if (error.status === 401) return NextResponse.json({ language: "en" });
    return errorResponse(error);
  }
}
