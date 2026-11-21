"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Laptop, MapPin, MonitorSmartphone, Shield, Smartphone, X } from "lucide-react";
import {
  translateServerMessage,
  useLanguage,
} from "@/components/language-provider";
export default function DevicesPage() {
  const router = useRouter();
  const { t } = useLanguage();
  const requestFailed = t.requestFailed;
  const serverError = t.serverError;
  const networkError = t.networkError;
  const [devices, setDevices] = useState([]); const [currentSessionId, setCurrentSessionId] = useState(""); const [inactivityMinutes, setInactivityMinutes] = useState(null); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/security/devices").then(async (response) => { const data = await response.json(); if (response.ok) { setDevices(data.sessions); setCurrentSessionId(data.currentSessionId); setInactivityMinutes(data.inactivityWindowMinutes); } else setError(translateServerMessage(response.status, { requestFailed, serverError })); }).catch(() => setError(networkError)); }, [networkError, requestFailed, serverError]);
  async function revoke(id) {
    try {
      const response = await fetch(`/api/security/devices/${id}`, { method: "DELETE" });
      if (response.ok) {
        setDevices((items) => items.filter((item) => item._id !== id));
        if (String(currentSessionId) === String(id)) router.replace("/login");
      }
      else setError(translateServerMessage(response.status, { requestFailed, serverError }));
    } catch {
      setError(networkError);
    }
  }
  const formatMinutes = (message) =>
    String(message || "").replaceAll(
      "{minutes}",
      inactivityMinutes == null ? "—" : String(inactivityMinutes),
    );
  return (
    <div className="page-enter mx-auto max-w-[900px]">
      <div className="mb-7">
        <p className="text-[10px] font-bold uppercase tracking-[1.3px] text-[#81916d]">
          {t.accountProtection}
        </p>
        <h1 className="mt-2 text-[29px] font-semibold tracking-[-1px]">
          {t.devicesSessions}
        </h1>
        <p className="mt-1 text-[12px] text-[#8c938b]">
          {t.devicesIntro}
        </p>
      </div>
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-[#e2e6dc] bg-[#fbfbf8] p-4">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#edf2e7] text-[#66804c]">
          <Shield size={16} />
        </span>
        <p className="pt-0.5 text-[11px] leading-relaxed text-[#768074]">
          {formatMinutes(t.sessionSecurityInfo)}
        </p>
      </div>
      {error && <p className="rounded-lg bg-[#fff0eb] p-3 text-[11px] text-[#994b36]">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#e5e7df] bg-[#fbfbf8]">
        {devices.length ? devices.map((device) => (
          <div key={device._id} className="flex flex-wrap items-center gap-3 border-b border-[#eceee7] p-4 last:border-0 sm:p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eff1eb] text-[#727e6a]">
              {device.deviceType === "mobile" ? <Smartphone size={18} /> : device.deviceType === "tablet" ? <MonitorSmartphone size={18} /> : <Laptop size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 text-[12px] font-semibold">
                {device.deviceLabel || `${device.browser} on ${device.operatingSystem}`}
                {String(device._id) === String(currentSessionId) && (
                  <span className="rounded bg-green-100 px-1.5 py-0.5 text-[9px] font-semibold text-green-800">
                    {t.currentDevice}
                  </span>
                )}
                {device.trusted && (
                  <span className="rounded bg-[#edf2e7] px-1.5 py-0.5 text-[9px] font-semibold text-[#66804c]">
                    {t.trustedDevice}
                  </span>
                )}
              </span>
                <span className="mt-1 block text-[10px] text-[#838b81]">
                  Browser: {device.browser || "Unknown"} · OS: {device.operatingSystem || "Unknown"} · Device: {device.deviceType || "Unknown"}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[10px] text-[#9aa097]">
                  <MapPin size={11} />{device.location || t.locationUnavailable} · {t.signedIn} {new Date(device.loginAt).toLocaleString()} · {t.lastActive} {new Date(device.lastActiveAt).toLocaleString()}
              </span>
              <span className="mt-1 block text-[9px] text-[#a7ada4]">
                {device.ipAddress || t.ipUnavailable}
              </span>
            </span>
            <button onClick={() => revoke(device._id)} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e7e8e2] px-2.5 text-[10px] text-[#7b8179] hover:border-[#e0bcb0] hover:bg-[#fff5f2] hover:text-[#9b503a]">
              <X size={13} />{t.revoke}
            </button>
          </div>
        )) : (
          <div className="px-5 py-12 text-center">
            <span className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#eff1eb] text-[#819077]">
              <Laptop size={19} />
            </span>
            <p className="mt-3 text-[12px] font-medium">
              {error ? "" : t.signInToSeeDevices}
            </p>
            <p className="mt-1 text-[10px] text-[#a0a69d]">
              {t.deviceListHint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}