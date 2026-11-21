import { Subscription } from "@/lib/models";

export async function getCurrentSubscription(userId, now = new Date()) {
  const subscription = await Subscription.findOne({
    $or: [{ userId }, { user: userId }],
    status: "active",
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!subscription || subscription.plan === "free") return subscription;
  if (subscription.renewalDate && subscription.renewalDate > now)
    return subscription;

  await Subscription.updateOne(
    { _id: subscription._id, status: "active" },
    { $set: { status: "expired", active: false } },
  );
  return null;
}

export async function getBillingStatus(userId, now = new Date()) {
  const subscription = await getCurrentSubscription(userId, now);
  if (!subscription || subscription.plan === "free")
    return {
      status: "inactive",
      plan: "Free",
      isActive: false,
      subscription: null,
    };

  return {
    status: subscription.status,
    plan: subscription.plan,
    isActive: subscription.status === "active",
    subscription,
  };
}

export async function requirePremium(userId) {
  const subscription = await getCurrentSubscription(userId);
  if (!subscription || subscription.plan === "free")
    throw Object.assign(new Error("An active paid subscription is required."), {
      status: 403,
    });
  return subscription;
}

export async function requireGoldOrSilver(userId) {
  const subscription = await getCurrentSubscription(userId);
  if (!subscription || !["gold", "silver"].includes(subscription.plan))
    throw Object.assign(new Error("Gold required."), { status: 403 });
  return subscription;
}