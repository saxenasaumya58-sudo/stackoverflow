import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { Notification } from "@/lib/models";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const unreadFilter = { recipient: user._id, readAt: null };
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ recipient: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("actor", "name")
      .populate("post", "content")
      .lean(),
      Notification.countDocuments(unreadFilter),
    ]);
    return NextResponse.json({ notifications, unreadCount });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH() {
  try {
    const { user } = await getAuth();
    await connectDB();
    await Notification.updateMany(
      { recipient: user._id, readAt: null },
      { $set: { read: true, readAt: new Date() } },
    );
    return NextResponse.json({ ok: true, unreadCount: 0 });
  } catch (error) {
    return errorResponse(error);
  }
}
