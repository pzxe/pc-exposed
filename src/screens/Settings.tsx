import { useEffect, useState } from "react";
import { useApp } from "@/app/state";
import { Button, Panel, ScreenHeader } from "@/components/ui";
import { reportStore, useReports } from "@/reports/store";
import { getAppInfo, type AppInfo } from "@/lib/tauri";
import type { MotionPref } from "@/lib/settings";
import { listLocales, useI18n, type MessageKey } from "@/i18n";
import { COLLECTED_SECTIONS, collectedKey, NEVER_COLLECTED } from "@/lib/privacyInfo";
import { checkForUpdates, DEFAULT_UPDATE_PROVIDER } from "@/lib/updates";
import { APP_VERSION } from "@/lib/version";

const motionOptions: { value: MotionPref; key: MessageKey }[] = [
  { value: "system", key: "settings.motion.system" },
  { value: "on", key: "settings.motion.on" },
  { value: "off", key: "settings.motion.off" },
];

const SECTION_NAMES: Record<(typeof COLLECTED_SECTIONS)[number], string> = {
  cpu: "Processor", gpus: "Graphics", memory: "Memory", storage: "Storage", os: "Operating system", startup: "Startup apps",
  apps: "Installed apps", battery: "Battery", network: "Network adapters", processes: "Processes",
};

export function SettingsScreen() {
  const { settings, updateSettings, resetAllLocalData } = useApp();
  const { t, tp } = useI18n();
  const reports = useReports();
  const [confirm, setConfirm] = useState<"reports" | "all" | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [info, setInfo] = useState<AppInfo | null>(null);
  const [updateNote, setUpdateNote] = useState<string | null>(null);
  const locales = listLocales();

  useEffect(() => {
    getAppInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  const version = info?.version ?? APP_VERSION;

  return (
    <div className="animate-rise space-y-4">
      <ScreenHeader title={t("settings.title")} subtitle={t("settings.subtitle")} />

      <Panel>
        <h2 className="mb-3 font-semibold">{t("settings.appearance")}</h2>
        <p className="mb-3 text-sm text-muted">{t("settings.theme")}</p>
        <div className="flex flex-wrap gap-6">
          <div>
            <label htmlFor="motion" className="mb-1 block text-sm text-muted">{t("settings.animations")}</label>
            <select id="motion" value={settings.motion} onChange={(e) => updateSettings({ motion: e.target.value as MotionPref })}
              className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm">
              {motionOptions.map((o) => <option key={o.value} value={o.value}>{t(o.key)}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="language" className="mb-1 block text-sm text-muted">{t("settings.language")}</label>
            <select id="language" value={settings.language} onChange={(e) => updateSettings({ language: e.target.value })}
              disabled={locales.length < 2} className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm disabled:opacity-60">
              {locales.map((l) => <option key={l.id} value={l.id} lang={l.id}>{l.nativeName}</option>)}
            </select>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted">{t("settings.language.note")}</p>
      </Panel>

      <Panel>
        <h2 className="mb-3 font-semibold">{t("settings.privacy")}</h2>
        <ul className="list-disc space-y-1 ps-5 text-sm text-muted">
          <li>{t("settings.privacy.local")}</li>
          <li>{t("settings.privacy.none")}</li>
          <li>{t("settings.privacy.share")}</li>
          <li>{t("settings.privacy.delete")}</li>
        </ul>
        <h3 className="mt-5 mb-1 text-sm font-semibold">{t("settings.collected.title")}</h3>
        <p className="mb-2 text-sm text-muted">{t("settings.collected.intro")}</p>
        <dl className="grid grid-cols-[10rem_1fr] gap-x-4 gap-y-1.5 text-sm" data-testid="collected-list">
          {COLLECTED_SECTIONS.map((id) => (
            <div key={id} className="contents">
              <dt className="font-medium">{SECTION_NAMES[id]}</dt>
              <dd className="text-muted">{t(collectedKey(id))}</dd>
            </div>
          ))}
        </dl>
        <h3 className="mt-5 mb-1 text-sm font-semibold">{t("settings.never.title")}</h3>
        <ul className="list-disc space-y-1 ps-5 text-sm text-muted" data-testid="never-list">
          {NEVER_COLLECTED.map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      </Panel>

      <Panel>
        <h2 className="mb-1 font-semibold">{t("settings.local.title")}</h2>
        <p className="mb-3 text-sm text-muted">
          {t("settings.local.body")} <span data-testid="report-count-text">{tp("settings.local.count", reports.length)}</span>
          <span hidden data-testid="report-count">{reports.length}</span>
        </p>
        <label className="mb-4 flex items-start gap-2 text-sm">
          <input type="checkbox" checked={settings.keepHistory} onChange={(e) => updateSettings({ keepHistory: e.target.checked })} className="mt-1 accent-[#a879ff]" />
          <span>
            <span className="font-medium">{t("settings.local.history")}</span>
            <span className="block text-xs text-muted">{t("settings.local.history.note")}</span>
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {confirm === null && (
            <>
              <Button variant="ghost" disabled={reports.length === 0} onClick={() => setConfirm("reports")}>{t("settings.local.deleteReports")}</Button>
              <Button variant="ghost" onClick={() => setConfirm("all")}>{t("settings.local.resetAll")}</Button>
            </>
          )}
          {confirm !== null && (
            <>
              <span className="text-sm text-warn">{confirm === "reports" ? tp("settings.local.confirmReports", reports.length) : t("settings.local.confirmAll")}</span>
              <Button onClick={() => {
                if (confirm === "reports") { reportStore.clear(); setDone(t("settings.local.doneReports")); }
                else { resetAllLocalData(); setDone(t("settings.local.doneAll")); }
                setConfirm(null);
              }}>{t("common.yesDelete")}</Button>
              <Button variant="ghost" onClick={() => setConfirm(null)}>{t("common.cancel")}</Button>
            </>
          )}
        </div>
        {done && <p role="status" className="mt-2 text-sm text-good">{done}</p>}
      </Panel>

      <Panel>
        <h2 className="mb-1 font-semibold">{t("settings.updates.title")}</h2>
        <p className="mb-3 text-sm text-muted">{t("settings.updates.body")}</p>
        <Button variant="ghost" onClick={async () => {
          const r = await checkForUpdates(version, DEFAULT_UPDATE_PROVIDER);
          setUpdateNote(r.status === "disabled" ? t("settings.updates.unconfigured") : null);
        }}>{t("settings.updates.button")}</Button>
        {updateNote && <p role="status" className="mt-2 text-sm text-muted">{updateNote}</p>}
      </Panel>

      <Panel>
        <h2 className="mb-3 font-semibold">{t("settings.about")}</h2>
        <dl className="grid grid-cols-[8rem_1fr] gap-y-1 text-sm">
          <dt className="text-muted">{t("settings.about.version")}</dt>
          <dd data-testid="app-version">{info ? info.version : `${version} (browser preview)`}</dd>
          <dt className="text-muted">{t("settings.about.license")}</dt>
          <dd>MIT</dd>
          <dt className="text-muted">{t("settings.about.platform")}</dt>
          <dd>{info ? `${info.os} / ${info.arch}` : t("settings.about.browser")}</dd>
        </dl>
        <h3 className="mt-4 mb-1 text-sm font-semibold">{t("settings.licenses.title")}</h3>
        <p className="text-sm text-muted">{t("settings.licenses.body")}</p>
      </Panel>
    </div>
  );
}
