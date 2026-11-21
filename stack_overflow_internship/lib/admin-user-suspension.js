import mongoose from "mongoose";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";

export async function setUserSuspension(userId, suspended) {
  const { user: actor } = await getAuth();
  if (actor.role !== "admin")
    throw Object.assign(new Error("Admin access is required."), {
      status: 403,
    });
  if (!mongoose.isObjectIdOrHexString(userId))
    throw Object.assign(new Error("A valid user ID is required."), {
      status: 400,
    });

  await connectDB();
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        isSuspended: suspended,
        suspendedAt: suspended ? new Date() : null,
      },
    },
    { new: true, runValidators: true },
  ).select("_id isSuspended suspendedAt");
  if (!user)
    throw Object.assign(new Error("User not found."), { status: 404 });

  return {
    id: String(user._id),
    isSuspended: user.isSuspended,
    suspendedAt: user.suspendedAt,
  };
}
