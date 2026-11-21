import crypto from "node:crypto";

export function hashDeviceSecret(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function matchesDeviceSecretValue(value, deviceIdHash) {
  if (
    typeof value !== "string" ||
    !/^[a-f0-9]{64}$/i.test(value) ||
    !/^[a-f0-9]{64}$/i.test(deviceIdHash || "")
  )
    return false;

  const actualHash = Buffer.from(hashDeviceSecret(value), "hex");
  const expectedHash = Buffer.from(deviceIdHash, "hex");
  return crypto.timingSafeEqual(actualHash, expectedHash);
}

export function isTrustedDevice(trustedDevices, deviceIdHash, now = new Date()) {
  return (
    Array.isArray(trustedDevices) &&
    trustedDevices.some(
      (device) =>
        device.deviceId === deviceIdHash &&
        new Date(device.expiresAt).getTime() > now.getTime(),
    )
  );
}

export function isSessionUsable(
  session,
  { now, inactivityWindowMs, deviceSecret },
) {
  const expiresAt = new Date(session?.expiresAt).getTime();
  const lastActiveAt = new Date(session?.lastActiveAt).getTime();
  const inactiveSince = now.getTime() - inactivityWindowMs;

  return Boolean(
    session &&
      session.purpose == null &&
      session.isActive !== false &&
      session.isRevoked !== true &&
      session.revokedAt == null &&
      expiresAt > now.getTime() &&
      lastActiveAt > inactiveSince &&
      matchesDeviceSecretValue(deviceSecret, session.deviceId),
  );
}

export function isDeviceOtpChallengeUsable(
  session,
  { now, maxAttempts },
) {
  const otpExpiresAt = new Date(session?.otpExpiresAt).getTime();
  const challengeExpiresAt = new Date(session?.expiresAt).getTime();

  return Boolean(
    session &&
      session.purpose === "device-login" &&
      session.isActive !== false &&
      session.revokedAt == null &&
      Number(session.loginVerificationAttempts || 0) < maxAttempts &&
      otpExpiresAt > now.getTime() &&
      challengeExpiresAt > now.getTime(),
  );
}

export function createLoginLogEntry(userId, session) {
  const loginAt = session.loginAt || new Date();
  return {
    user: userId,
    userId,
    browser: session.browser,
    os: session.os,
    operatingSystem: session.operatingSystem,
    deviceLabel: session.deviceLabel,
    deviceType: session.deviceType,
    ip: session.ipAddress,
    ipAddress: session.ipAddress,
    location: session.location,
    deviceId: session.deviceId,
    loginAt,
    createdAt: loginAt,
  };
}
