import "server-only";
import crypto from "node:crypto";
import { isIP } from "node:net";
import { UAParser } from "ua-parser-js";
import { LoginLog } from "@/lib/models";
import {
  createLoginLogEntry,
  hashDeviceSecret as hashDeviceSecretValue,
  isTrustedDevice as isTrustedDeviceValue,
  matchesDeviceSecretValue,
} from "@/lib/device-security.mjs";
import { getDeviceCookieLifetimeSeconds } from "@/lib/session-config";

export const DEVICE_COOKIE_NAME = "commons_device";

function getRequestIp(request) {
  const requestIp = request?.ip;
  if (typeof requestIp === "string" && isIP(requestIp)) return requestIp;

  const trustedProxy = process.env.TRUSTED_PROXY_IP_HEADER === "true";
  const forwardedIps = [
    ...(request?.headers?.get("x-forwarded-for") || "").split(","),
    request?.headers?.get("x-real-ip") || "",
  ]
    .map((ip) => ip.trim())
    .filter((ip) => isIP(ip));
  const allowedIps = trustedProxy
    ? forwardedIps
    : process.env.NODE_ENV !== "production"
      ? forwardedIps.filter(
          (ip) =>
            ip === "127.0.0.1" ||
            ip === "::1" ||
            ip === "::ffff:127.0.0.1",
        )
      : [];

  return allowedIps[0] || "Unknown";
}

export function getLoginDetails(request) {
  const userAgent = request?.headers?.get("user-agent") || "";
  const parsed = new UAParser(userAgent).getResult();
  const browser = parsed.browser.name || "Unknown";
  const operatingSystem = parsed.os.name || "Unknown";
  const deviceType =
    parsed.device.type ||
    (operatingSystem === "Unknown" ? "unknown" : "desktop");
  const geo = request?.geo || {};

  return {
    browser,
    os: operatingSystem,
    operatingSystem,
    deviceType,
    deviceLabel: `${browser} on ${operatingSystem}`,
    ipAddress: getRequestIp(request),
    location:
      [geo.city, geo.region, geo.country].filter(Boolean).join(", ") ||
      "Unknown",
  };
}

export function getOrCreateDeviceSecret(request) {
  return getDeviceSecret(request) || crypto.randomBytes(32).toString("hex");
}

export function getDeviceSecret(request) {
  const value = request?.cookies?.get(DEVICE_COOKIE_NAME)?.value || "";
  return /^[a-f0-9]{64}$/i.test(value) ? value.toLowerCase() : "";
}

export function hashDeviceSecret(value) {
  return hashDeviceSecretValue(value);
}

export function matchesDeviceSecret(request, deviceIdHash) {
  return matchesDeviceSecretValue(getDeviceSecret(request), deviceIdHash);
}

export function isTrustedDevice(
  trustedDevices,
  deviceIdHash,
  now = new Date(),
) {
  return isTrustedDeviceValue(trustedDevices, deviceIdHash, now);
}

export function setDeviceCookie(response, value) {
  response.cookies.set(DEVICE_COOKIE_NAME, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: getDeviceCookieLifetimeSeconds(),
  });
  return response;
}

export async function recordLogin(userId, session) {
  await LoginLog.create(createLoginLogEntry(userId, session));
}
