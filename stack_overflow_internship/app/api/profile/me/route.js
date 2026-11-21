import { NextResponse } from "next/server";
import { getAuth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { errorResponse } from "@/lib/http";
import { ReputationLog, User } from "@/lib/models";
import { awardReputation } from "@/lib/services";
import { getCurrentSubscription } from "@/lib/subscriptions";
import { REPUTATION_AWARDS } from "@/lib/reputation-policy.mjs";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { user } = await getAuth();
    await connectDB();
    const [profile, reputation, subscription] = await Promise.all([
      User.findById(user._id).select(
        "name bio location website avatarUrl reputation createdAt",
      ),
      ReputationLog.find({ user: user._id })
        .sort({ createdAt: -1 })
        .lean(),
      getCurrentSubscription(user._id),
    ]);
    return NextResponse.json({ user: profile, reputation, subscription });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request) {
  try {
    const { user } = await getAuth();
    const body = await request.json();
    await connectDB();
    for (const field of ["name", "bio", "location", "website", "avatarUrl"])
      if (typeof body[field] === "string") user[field] = body[field].trim();
    if (user.name.length < 2 || user.bio.length > 500)
      throw Object.assign(new Error("Check your name and bio."), {
        status: 400,
      });
    if (user.website) {
      let website;
      try { website = new URL(user.website); } catch { throw Object.assign(new Error("Enter a valid website URL."), { status: 400 }); }
      if (!["http:", "https:"].includes(website.protocol)) throw Object.assign(new Error("Website must use HTTP or HTTPS."), { status: 400 });
    }
    const complete = !!(
      user.name &&
      user.email &&
      user.mobile &&
      user.bio &&
      user.location
    );
    if (user.mobile) {
      await user.save();
    } else {
      const result = await User.collection.updateOne(
        { _id: user._id },
        {
          $set: {
            name: user.name,
            bio: user.bio,
            location: user.location,
            website: user.website,
            avatarUrl: user.avatarUrl,
          },
        },
      );
      if (result.matchedCount !== 1)
        throw Object.assign(new Error("Your session is invalid or expired."), {
          status: 401,
        });
    }
    if (complete) {
      const claim = await User.findOneAndUpdate(
        { _id: user._id, profileBonusAwardedAt: { $in: [null] } },
        { $set: { profileBonusAwardedAt: new Date() } },
        { new: true },
      );
      if (claim) {
        user.profileBonusAwardedAt = claim.profileBonusAwardedAt;
        try {
          await awardReputation(
            user._id,
            REPUTATION_AWARDS.profileComplete,
            "Completed profile with all mandatory details",
            `profile-complete:${user._id}`,
            user._id,
          );
        } catch (error) {
          await User.updateOne(
            { _id: user._id, profileBonusAwardedAt: claim.profileBonusAwardedAt },
            { $unset: { profileBonusAwardedAt: 1 } },
          );
          throw error;
        }
      }
    }
    const updated = await User.findById(user._id).select("reputation");
    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        bio: user.bio,
        location: user.location,
        website: user.website,
        reputation: updated.reputation,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
