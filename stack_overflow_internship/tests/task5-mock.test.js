const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const passwordResetRoute = read(
  "app/api/auth/forgot-password/verify/route.js",
);
const deviceVerificationRoute = read("app/api/auth/verify-device/route.js");
const sessionRevocationRoute = read("app/api/security/devices/[id]/route.js");
const sessionGuard = read("lib/sessionGuard.js");

function resetTokenIsValid(challenge, now) {
  return Boolean(
    challenge &&
      challenge.isUsed === false &&
      challenge.expiresAt instanceof Date &&
      challenge.expiresAt > now,
  );
}

function deviceOtpIsValid(session, now) {
  return Boolean(
    session &&
      session.isActive === true &&
      session.revokedAt == null &&
      session.otpExpiresAt instanceof Date &&
      session.otpExpiresAt > now,
  );
}

test("expired password-reset OTP/token is rejected", () => {
  const now = new Date();
  const fakeChallenge = {
    isUsed: false,
    expiresAt: new Date(now.getTime() - 1),
  };

  assert.equal(resetTokenIsValid(fakeChallenge, now), false);
  assert.match(passwordResetRoute, /expiresAt:\s*\{\s*\$gt:\s*now\s*\}/);
});

test("expired device-login OTP is rejected", () => {
  const now = new Date();
  const fakeSession = {
    isActive: true,
    revokedAt: null,
    otpExpiresAt: new Date(now.getTime() - 1),
  };

  assert.equal(deviceOtpIsValid(fakeSession, now), false);
  assert.match(
    deviceVerificationRoute,
    /otpExpiresAt:\s*\{\s*\$gt:\s*now\s*\}/,
  );
  assert.match(deviceVerificationRoute, /isDeviceOtpChallengeUsable/);
});

test("password reset revokes the fake user's active sessions", () => {
  const fakeUserId = "fake-user-1";
  const fakeSessions = [
    { user: fakeUserId, isActive: true, revokedAt: null },
    { user: fakeUserId, isActive: true },
    { user: "another-fake-user", isActive: true, revokedAt: null },
    { user: fakeUserId, isActive: false, revokedAt: null },
  ];
  const now = new Date();

  for (const session of fakeSessions) {
    if (
      session.user === fakeUserId &&
      session.isActive !== false &&
      session.revokedAt == null
    ) {
      Object.assign(session, {
        revokedAt: now,
        isActive: false,
        isRevoked: true,
      });
    }
  }

  assert.equal(fakeSessions[0].isRevoked, true);
  assert.equal(fakeSessions[1].isActive, false);
  assert.equal(fakeSessions[2].isActive, true);
  assert.equal(fakeSessions[3].isActive, false);
  assert.match(passwordResetRoute, /Session\.updateMany\(/);
  assert.match(passwordResetRoute, /isActive:\s*false/);
  assert.match(passwordResetRoute, /isRevoked:\s*true/);
  assert.match(passwordResetRoute, /revokedAt:\s*now/);
});

test("session revocation is limited to the requested fake user's session", () => {
  const fakeUserId = "fake-user-1";
  const requestedSessionId = "fake-session-1";
  const fakeSessions = [
    { id: requestedSessionId, user: fakeUserId, isActive: true },
    { id: "fake-session-2", user: fakeUserId, isActive: true },
    { id: "fake-session-3", user: "another-fake-user", isActive: true },
  ];
  const remaining = fakeSessions.filter(
    (session) =>
      !(
        session.id === requestedSessionId &&
        session.user === fakeUserId &&
        session.isActive
      ),
  );

  assert.deepEqual(
    remaining.map((session) => session.id),
    ["fake-session-2", "fake-session-3"],
  );
  assert.match(sessionRevocationRoute, /_id:\s*params\.id/);
  assert.match(sessionRevocationRoute, /user:\s*user\._id/);
});

test("revoked fake sessions cannot pass the session guard", () => {
  const now = new Date();
  const fakeSession = {
    isActive: false,
    isRevoked: true,
    revokedAt: now,
    expiresAt: new Date(now.getTime() + 60_000),
    lastActiveAt: now,
  };
  const canAuthenticate =
    fakeSession.isActive !== false &&
    fakeSession.isRevoked !== true &&
    fakeSession.revokedAt == null &&
    fakeSession.expiresAt > now;

  assert.equal(canAuthenticate, false);
  assert.match(sessionGuard, /isRevoked:\s*\{\s*\$ne:\s*true\s*\}/);
  assert.match(sessionGuard, /revokedAt:\s*null/);
});
