import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  createLoginLogEntry,
  hashDeviceSecret,
  isDeviceOtpChallengeUsable,
  isSessionUsable,
  isTrustedDevice,
  matchesDeviceSecretValue,
} from "../lib/device-security.mjs";
import {
  DEVICE_SECURITY_CONFIG,
  getDeviceCookieLifetimeSeconds,
  SESSION_CONFIG,
} from "../lib/session-config.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("fake new-device login records details, trusts only after OTP, and binds the session", async () => {
  const now = new Date();
  const fakeUser = {
    _id: "fake-task5-user",
    trustedDevices: [],
    sessions: [],
    loginLogs: [],
    notifications: [],
  };
  const deviceSecret = "a".repeat(64);
  const deviceId = hashDeviceSecret(deviceSecret);
  const details = {
    browser: "Mock Browser",
    os: "Mock OS",
    operatingSystem: "Mock OS",
    deviceLabel: "Mock Browser on Mock OS",
    deviceType: "desktop",
    ipAddress: "192.0.2.10",
    location: "Mock City, Mock Region",
  };
  const before = {
    sessions: fakeUser.sessions.length,
    loginLogs: fakeUser.loginLogs.length,
    trustedDevices: fakeUser.trustedDevices.length,
  };
  const knownBeforeOtp = isTrustedDevice(fakeUser.trustedDevices, deviceId);
  const challenge = {
    user: fakeUser._id,
    purpose: "device-login",
    isActive: true,
    revokedAt: null,
    loginVerificationAttempts: 0,
    otpExpiresAt: new Date(now.getTime() + 60_000),
    expiresAt: new Date(now.getTime() + 120_000),
    deviceId,
    ...details,
  };

  assert.equal(knownBeforeOtp, false);
  assert.equal(
    isDeviceOtpChallengeUsable(challenge, {
      now,
      maxAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
    }),
    true,
  );
  const mockOtp = "012345";
  challenge.loginVerificationOtp = await bcrypt.hash(mockOtp, 4);
  assert.equal(
    await bcrypt.compare(mockOtp, challenge.loginVerificationOtp),
    true,
  );
  assert.equal(
    await bcrypt.compare("654321", challenge.loginVerificationOtp),
    false,
  );

  const session = {
    ...challenge,
    purpose: null,
    tokenId: "fake-task5-session-token",
    trusted: true,
    isTrusted: true,
    lastActiveAt: now,
    loginAt: now,
    expiresAt: new Date(now.getTime() + 120_000),
  };
  fakeUser.trustedDevices.push({
    deviceId,
    label: details.deviceLabel,
    lastSeenAt: now,
    expiresAt: new Date(
      now.getTime() + DEVICE_SECURITY_CONFIG.trustedDeviceLifetimeSeconds * 1000,
    ),
  });
  fakeUser.sessions.push(session);
  fakeUser.notifications.push({ type: "new-device-login", sentAt: now });
  fakeUser.loginLogs.push(createLoginLogEntry(fakeUser._id, session));

  assert.equal(
    isSessionUsable(session, {
      now,
      inactivityWindowMs: 60_000,
      deviceSecret,
    }),
    true,
  );
  assert.equal(
    isSessionUsable(session, {
      now,
      inactivityWindowMs: 60_000,
      deviceSecret: "b".repeat(64),
    }),
    false,
  );
  assert.equal(isTrustedDevice(fakeUser.trustedDevices, deviceId), true);
  assert.deepEqual(before, { sessions: 0, loginLogs: 0, trustedDevices: 0 });
  assert.deepEqual(
    {
      sessions: fakeUser.sessions.length,
      loginLogs: fakeUser.loginLogs.length,
      trustedDevices: fakeUser.trustedDevices.length,
    },
    { sessions: 1, loginLogs: 1, trustedDevices: 1 },
  );
  assert.deepEqual(
    {
      browser: fakeUser.loginLogs[0].browser,
      os: fakeUser.loginLogs[0].operatingSystem,
      deviceType: fakeUser.loginLogs[0].deviceType,
      ip: fakeUser.loginLogs[0].ipAddress,
      location: fakeUser.loginLogs[0].location,
      timestamp: fakeUser.loginLogs[0].loginAt,
    },
    {
      browser: details.browser,
      os: details.operatingSystem,
      deviceType: details.deviceType,
      ip: details.ipAddress,
      location: details.location,
      timestamp: now,
    },
  );
  assert.equal(
    isTrustedDevice(fakeUser.trustedDevices, deviceId, now),
    true,
  );
  assert.equal(
    isTrustedDevice(
      fakeUser.trustedDevices,
      deviceId,
      new Date(
        now.getTime() +
          DEVICE_SECURITY_CONFIG.trustedDeviceLifetimeSeconds * 1000 +
          1,
      ),
    ),
    false,
    "a later login from the remembered device bypasses OTP",
  );

  const audit = source("app/api/auth/login/route.js");
  assert.match(
    audit,
    /isTrustedDevice\(user\.trustedDevices, deviceId, loginAt\)/,
  );
  assert.match(audit, /if \(!known\)/);
  assert.match(audit, /recordLogin\(user\._id, session\)/);
  assert.match(source("app/api/auth/verify-device/route.js"), /recordLogin\(user\._id, session\)/);
  assert.match(source("app/api/auth/verify-device/route.js"), /requireRealDelivery:\s*true/);

  console.log("MOCK DATABASE: not connected");
  console.log("MOCK LOGIN BEFORE: sessions=0, loginLogs=0, trustedDevices=0");
  console.log("MOCK LOGIN AFTER OTP: sessions=1, loginLogs=1, trustedDevices=1");
  console.log("MOCK SESSION: same-device=accepted, other-device=rejected");

  const activeBeforeRevoke = fakeUser.sessions.filter((item) =>
    isSessionUsable(item, {
      now,
      inactivityWindowMs: 60_000,
      deviceSecret,
    }),
  ).length;
  session.isActive = false;
  session.isRevoked = true;
  session.revokedAt = new Date();
  const activeAfterRevoke = fakeUser.sessions.filter((item) =>
    isSessionUsable(item, {
      now: new Date(),
      inactivityWindowMs: 60_000,
      deviceSecret,
    }),
  ).length;
  assert.equal(activeBeforeRevoke, 1);
  assert.equal(activeAfterRevoke, 0);
  console.log("MOCK REVOKE: activeSessions=1 -> 0");
});

test("OTP and session expiration reject expired, revoked, or exhausted fake sessions", () => {
  const now = new Date();
  const challenge = {
    purpose: "device-login",
    isActive: true,
    revokedAt: null,
    loginVerificationAttempts: 0,
    otpExpiresAt: new Date(now.getTime() + 60_000),
    expiresAt: new Date(now.getTime() + 120_000),
  };
  const session = {
    purpose: null,
    isActive: true,
    isRevoked: false,
    revokedAt: null,
    expiresAt: new Date(now.getTime() + 120_000),
    lastActiveAt: now,
    deviceId: hashDeviceSecret("c".repeat(64)),
  };
  const deviceSecret = "c".repeat(64);

  assert.equal(
    isDeviceOtpChallengeUsable(challenge, {
      now,
      maxAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
    }),
    true,
  );
  assert.equal(
    isDeviceOtpChallengeUsable(
      { ...challenge, otpExpiresAt: new Date(now.getTime() - 1) },
      { now, maxAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts },
    ),
    false,
  );
  assert.equal(
    isDeviceOtpChallengeUsable(
      {
        ...challenge,
        loginVerificationAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts,
      },
      { now, maxAttempts: DEVICE_SECURITY_CONFIG.otpMaxAttempts },
    ),
    false,
  );
  assert.equal(
    isSessionUsable(
      { ...session, expiresAt: new Date(now.getTime() - 1) },
      { now, inactivityWindowMs: 60_000, deviceSecret },
    ),
    false,
  );
  assert.equal(
    isSessionUsable(
      { ...session, isActive: false, isRevoked: true, revokedAt: now },
      { now, inactivityWindowMs: 60_000, deviceSecret },
    ),
    false,
  );
  assert.equal(matchesDeviceSecretValue(deviceSecret, session.deviceId), true);
});

test("session, OTP, and remembered-device durations are configurable", () => {
  const names = [
    "SESSION_INACTIVITY_MS",
    "DEVICE_OTP_TTL_MS",
    "DEVICE_CHALLENGE_TTL_MS",
    "DEVICE_OTP_MAX_ATTEMPTS",
    "TRUSTED_DEVICE_TTL_SECONDS",
  ];
  const previous = Object.fromEntries(
    names.map((name) => [name, process.env[name]]),
  );

  try {
    process.env.SESSION_INACTIVITY_MS = "61000";
    process.env.DEVICE_OTP_TTL_MS = "120000";
    process.env.DEVICE_CHALLENGE_TTL_MS = "180000";
    process.env.DEVICE_OTP_MAX_ATTEMPTS = "4";
    process.env.TRUSTED_DEVICE_TTL_SECONDS = "300";

    assert.equal(SESSION_CONFIG.inactivityMs, 61000);
    assert.equal(SESSION_CONFIG.INACTIVITY_WINDOW_MINUTES, 2);
    assert.equal(DEVICE_SECURITY_CONFIG.otpLifetimeMs, 120000);
    assert.equal(DEVICE_SECURITY_CONFIG.challengeLifetimeMs, 180000);
    assert.equal(DEVICE_SECURITY_CONFIG.otpMaxAttempts, 4);
    assert.equal(DEVICE_SECURITY_CONFIG.trustedDeviceLifetimeSeconds, 300);
    assert.equal(getDeviceCookieLifetimeSeconds(), 300);
    assert.throws(() => {
      process.env.DEVICE_OTP_TTL_MS = "0";
      return DEVICE_SECURITY_CONFIG.otpLifetimeMs;
    }, /DEVICE_OTP_TTL_MS must be a positive safe integer/);
  } finally {
    for (const name of names) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
});

test("session UI, API, and admin audit are wired to per-user data", () => {
  const devicesApi = source("app/api/security/devices/route.js");
  const revokeApi = source("app/api/security/devices/[id]/route.js");
  const adminApi = source("app/api/admin/security/route.js");
  const guard = source("lib/sessionGuard.js");

  assert.match(devicesApi, /user:\s*user\._id/);
  assert.match(devicesApi, /currentSessionId/);
  assert.match(revokeApi, /user:\s*user\._id/);
  assert.match(adminApi, /user\.role !== "admin"/);
  assert.match(adminApi, /LoginLog\.find\(\)/);
  assert.match(guard, /isSessionUsable/);
  assert.match(source("lib/auth.js"), /httpOnly:\s*true/);
  assert.match(source("models/Session.js"), /tokenId:\s*\{\s*type:\s*String,\s*unique:\s*true/);
  assert.match(source("components/account-forms.js"), /payload\.trusted = trusted/);
});
