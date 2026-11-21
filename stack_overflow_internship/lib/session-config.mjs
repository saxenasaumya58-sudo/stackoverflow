const DEFAULT_INACTIVITY_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_DEVICE_OTP_LIFETIME_MS = 10 * 60 * 1000;
const DEFAULT_DEVICE_CHALLENGE_LIFETIME_MS = 24 * 60 * 60 * 1000;
const DEFAULT_TRUSTED_DEVICE_LIFETIME_SECONDS = 365 * 24 * 60 * 60;
const DEFAULT_DEVICE_OTP_MAX_ATTEMPTS = 5;

function getPositiveIntegerEnv(name, defaultValue) {
  const value = process.env[name];
  if (!value) return defaultValue;
  if (!/^\d+$/.test(value)) {
    throw new Error(`${name} must be a positive integer.`);
  }
  const configured = Number(value);
  if (!Number.isSafeInteger(configured) || configured <= 0) {
    throw new Error(`${name} must be a positive safe integer.`);
  }
  return configured;
}

function getInactivityWindowMs() {
  return getPositiveIntegerEnv(
    "SESSION_INACTIVITY_MS",
    DEFAULT_INACTIVITY_WINDOW_MS,
  );
}

export const SESSION_CONFIG = Object.freeze({
  get INACTIVITY_WINDOW_MS() {
    return getInactivityWindowMs();
  },
  get INACTIVITY_WINDOW_MINUTES() {
    return Math.ceil(getInactivityWindowMs() / 60000);
  },
  get inactivityMs() {
    return getInactivityWindowMs();
  },
});

export const DEVICE_SECURITY_CONFIG = Object.freeze({
  get otpLifetimeMs() {
    return getPositiveIntegerEnv(
      "DEVICE_OTP_TTL_MS",
      DEFAULT_DEVICE_OTP_LIFETIME_MS,
    );
  },
  get challengeLifetimeMs() {
    return getPositiveIntegerEnv(
      "DEVICE_CHALLENGE_TTL_MS",
      DEFAULT_DEVICE_CHALLENGE_LIFETIME_MS,
    );
  },
  get trustedDeviceLifetimeSeconds() {
    return getPositiveIntegerEnv(
      "TRUSTED_DEVICE_TTL_SECONDS",
      DEFAULT_TRUSTED_DEVICE_LIFETIME_SECONDS,
    );
  },
  get otpMaxAttempts() {
    return getPositiveIntegerEnv(
      "DEVICE_OTP_MAX_ATTEMPTS",
      DEFAULT_DEVICE_OTP_MAX_ATTEMPTS,
    );
  },
});

export function getDeviceCookieLifetimeSeconds() {
  return Math.max(
    DEVICE_SECURITY_CONFIG.trustedDeviceLifetimeSeconds,
    Math.ceil(DEVICE_SECURITY_CONFIG.challengeLifetimeMs / 1000),
    Math.ceil(SESSION_CONFIG.inactivityMs / 1000),
  );
}

export function getTrustedDeviceExpiry(now = new Date()) {
  return new Date(
    now.getTime() + DEVICE_SECURITY_CONFIG.trustedDeviceLifetimeSeconds * 1000,
  );
}

export const INACTIVITY_TIMEOUT = SESSION_CONFIG.inactivityMs;
