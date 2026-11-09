import type { Facts } from "./facts";
import type { CategoryScore, RoastCategory } from "./types";

export interface RoastContext {
  f: Facts;
  s: Partial<Record<CategoryScore["id"], number>>;
  overall: number | null;
  personalityId: string;
}

export interface RoastEntry {
  id: string;
  category: RoastCategory;
  /** 1 generic, 2 uses one fact, 3 uses a distinctive fact or combination. */
  specificity: 1 | 2 | 3;
  when: (c: RoastContext) => boolean;
  text: (c: RoastContext) => string;
}

// ---- helpers (all inputs come from real facts; callers guard with `when`) ----
const n = (v: number | undefined) => Math.round(v ?? 0);
const gpu = (c: RoastContext) =>
  (c.f.gpuName ?? "this GPU").replace(/NVIDIA |GeForce |AMD |\(R\)|\(TM\)/g, "").replace(/\s+/g, " ").trim();
const has = (c: RoastContext, re: RegExp) => c.f.startupNames.some((s) => re.test(s));
const tier = (c: RoastContext) => c.f.gpuClass?.tier ?? -1;
const always = () => true;

const e = (
  id: string, category: RoastCategory, specificity: RoastEntry["specificity"],
  when: RoastEntry["when"], text: RoastEntry["text"],
): RoastEntry => ({ id, category, specificity, when, text });

export const ROAST_LIBRARY: RoastEntry[] = [
  // ───────────────────────── HARDWARE ─────────────────────────
  e("hw-gpu5-tabs", "hardware", 2, (c) => tier(c) >= 5, (c) => `A ${gpu(c)} rendering browser tabs. That's a Ferrari doing the school run.`),
  e("hw-gpu5-discord", "hardware", 3, (c) => tier(c) >= 4 && has(c, /discord/i), (c) => `${gpu(c)} on a PC that launches Discord at login. Flagship power, group-chat ambitions.`),
  e("hw-gpu-vram", "hardware", 3, (c) => (c.f.gpuVramGb ?? 0) >= 12 && !c.f.gpuIntegrated, (c) => `${n(c.f.gpuVramGb)} GB of VRAM and you still alt-tab to check a wiki.`),
  e("hw-gpu-mid", "hardware", 2, (c) => tier(c) >= 2 && tier(c) <= 3, (c) => `${gpu(c)}: not a flex, not a cry for help. A solid shrug.`),
  e("hw-gpu-low", "hardware", 2, (c) => tier(c) === 1, (c) => `${gpu(c)} is giving "it runs, don't ask how."`),
  e("hw-gpu-igpu", "hardware", 3, (c) => c.f.gpuIntegrated === true, () => "Integrated graphics. Your PC draws with whatever it found in the drawer."),
  e("hw-cpu-many", "hardware", 3, (c) => (c.f.logicalThreads ?? 0) >= 16, (c) => `${c.f.logicalThreads} threads and most of them are idle. Delegation has never looked so lazy.`),
  e("hw-cpu-chrome", "hardware", 3, (c) => (c.f.logicalThreads ?? 0) >= 12 && c.f.browserRunning, (c) => `${c.f.logicalThreads} threads, and a browser is still in the top memory spots.`),
  e("hw-cpu-huge", "hardware", 3, (c) => (c.f.logicalThreads ?? 0) >= 24, (c) => `${c.f.logicalThreads} threads. You could host a small town on this.`),
  e("hw-cpu-few", "hardware", 3, (c) => c.f.logicalThreads !== undefined && c.f.logicalThreads <= 4, (c) => `${c.f.logicalThreads} threads. Every background app is a hostile negotiation.`),
  e("hw-cpu-idle", "hardware", 2, (c) => c.f.cpuUtilPercent !== undefined && c.f.cpuUtilPercent < 10, (c) => `CPU at ${n(c.f.cpuUtilPercent)}% during the scan. It's basically on a coffee break.`),
  e("hw-cpu-busy", "hardware", 2, (c) => (c.f.cpuUtilPercent ?? 0) >= 70, (c) => `CPU at ${n(c.f.cpuUtilPercent)}% while you stared at a scan screen. What are you hiding?`),
  e("hw-ram-huge", "hardware", 3, (c) => (c.f.ramGb ?? 0) >= 60, (c) => `${n(c.f.ramGb)} GB of RAM. Enough to remember every tab you'll never read.`),
  e("hw-ram-chrome", "hardware", 3, (c) => (c.f.ramGb ?? 0) >= 30 && c.f.browserRunning, (c) => `${n(c.f.ramGb)} GB of RAM and a browser still wins the memory race.`),
  e("hw-ram-ok", "hardware", 2, (c) => (c.f.ramGb ?? 0) >= 15 && (c.f.ramGb ?? 0) < 30, (c) => `${n(c.f.ramGb)} GB of RAM: comfortable, until you open a second launcher.`),
  e("hw-ram-low", "hardware", 3, (c) => c.f.ramGb !== undefined && c.f.ramGb < 12, (c) => `${n(c.f.ramGb)} GB of RAM. You're one browser tab away from a cry for help.`),
  e("hw-ram-pressure", "hardware", 3, (c) => (c.f.ramUsedPercent ?? 0) >= 80, (c) => `RAM at ${n(c.f.ramUsedPercent)}% and you haven't even opened a game. Something is hoarding.`),
  e("hw-uptime-long", "hardware", 3, (c) => (c.f.uptimeDays ?? 0) >= 14, (c) => `Up for ${n(c.f.uptimeDays)} days. Restart it before it files a complaint.`),
  e("hw-uptime-short", "hardware", 2, (c) => c.f.uptimeDays !== undefined && c.f.uptimeDays < 0.5, () => "Booted a few hours ago. Fresh start energy. Let's see how long that lasts."),
  e("hw-rgb2", "hardware", 3, (c) => c.f.rgbApps.length >= 2, (c) => `${c.f.rgbApps.length} separate lighting suites installed. The glow has middle management.`),
  e("hw-rgb1", "hardware", 2, (c) => c.f.rgbApps.length === 1, (c) => `${c.f.rgbApps[0]} is installed. Your PC has a mood and it chose color.`),
  e("hw-battery", "hardware", 2, (c) => c.f.hasBattery === true, () => "It has a battery, so technically it's portable. Walk it to the next room and report back."),
  e("hw-win10", "hardware", 3, (c) => c.f.isWindows10 === true, () => "Still on Windows 10. Even the operating system is asking about retirement plans."),
  e("hw-win11", "hardware", 1, (c) => c.f.isWindows11 === true, () => "Windows 11, so at least one thing in here is current."),
  e("hw-cores-ratio", "hardware", 2, (c) => c.f.physicalCores !== undefined && c.f.logicalThreads !== undefined && c.f.logicalThreads >= c.f.physicalCores * 2 && c.f.physicalCores >= 6, (c) => `${c.f.physicalCores} real cores pretending to be ${c.f.logicalThreads}. It's a very productive illusion.`),
  e("hw-generic-1", "hardware", 1, always, () => "Hardware so honest it didn't even try to hide. We respect it."),
  e("hw-generic-2", "hardware", 1, always, () => "Your PC didn't ask to be investigated, and yet here we are."),

  e("hw-gpu-amd", "hardware", 2, (c) => /radeon|\bRX\b/i.test(c.f.gpuName ?? "") && tier(c) >= 3, (c) => `${gpu(c)}: red team, and apparently proud of it.`),
  e("hw-gpu-intel-arc", "hardware", 3, (c) => /\bArc\b/i.test(c.f.gpuName ?? ""), () => "An Intel Arc card. Brave. Drivers have come a long way, so have you."),

  // ───────────────────────── STARTUP ─────────────────────────
  e("st-huge", "startup", 3, (c) => (c.f.startupEnabled ?? 0) >= 25, (c) => `${c.f.startupEnabled} startup entries. Your boot sequence is basically a group chat.`),
  e("st-many", "startup", 3, (c) => (c.f.startupEnabled ?? 0) >= 15 && (c.f.startupEnabled ?? 0) < 25, (c) => `${c.f.startupEnabled} things launch at login. Your startup folder needs an intervention.`),
  e("st-some", "startup", 2, (c) => (c.f.startupEnabled ?? 0) >= 9 && (c.f.startupEnabled ?? 0) < 15, (c) => `${c.f.startupEnabled} startup items. Not a crisis, but it's sniffing around one.`),
  e("st-few", "startup", 2, (c) => c.f.startupEnabled !== undefined && c.f.startupEnabled >= 1 && c.f.startupEnabled <= 8, (c) => `Only ${c.f.startupEnabled} startup ${c.f.startupEnabled === 1 ? "entry" : "entries"}. Suspiciously disciplined.`),
  e("st-zero", "startup", 3, (c) => c.f.startupEnabled === 0, () => "Zero startup entries. You're either a saint or hiding something."),
  e("st-discord", "startup", 3, (c) => has(c, /discord/i), () => "Discord launches at startup. Of course it does."),
  e("st-steam", "startup", 3, (c) => has(c, /steam/i), () => "Steam wakes up before you do. Priorities are very clear."),
  e("st-spotify", "startup", 3, (c) => has(c, /spotify/i), () => "Spotify starts with Windows. Your PC is DJ-ing before you've even logged in."),
  e("st-onedrive", "startup", 3, (c) => has(c, /onedrive/i), () => "OneDrive starts with Windows, faithfully syncing files you forgot existed."),
  e("st-teams", "startup", 3, (c) => has(c, /teams/i), () => "Teams starts at login. Nothing says 'good morning' like a meeting you didn't ask for."),
  e("st-adobe", "startup", 3, (c) => has(c, /adobe|creative cloud/i), () => "Adobe launches itself at startup. Nobody asked, and yet it's always there."),
  e("st-disabled", "startup", 3, (c) => (c.f.startupDisabled ?? 0) > (c.f.startupEnabled ?? 99), (c) => `${c.f.startupDisabled} startup entries disabled. Growth. Character development.`),
  e("st-disabled-some", "startup", 2, (c) => (c.f.startupDisabled ?? 0) >= 5, (c) => `${c.f.startupDisabled} disabled startup entries sit around like retired employees.`),
  e("st-generic-1", "startup", 1, always, () => "Every app thinks it deserves to start with Windows. Most of them are wrong."),
  e("st-generic-2", "startup", 1, always, () => "Boot time is just a negotiation between your patience and your startup list."),

  // ───────────────────────── STORAGE ─────────────────────────
  e("sto-critical", "storage", 3, (c) => (c.f.systemFreePercent ?? 100) < 10, (c) => `${n(c.f.systemFreePercent)}% free on the system drive. Windows is sleeping in the hallway.`),
  e("sto-low", "storage", 3, (c) => (c.f.systemFreePercent ?? 100) >= 10 && (c.f.systemFreePercent ?? 100) < 20, (c) => `${n(c.f.systemFreePercent)}% free on C:. It's not full yet, just emotionally prepared for it.`),
  e("sto-roomy", "storage", 3, (c) => (c.f.systemFreePercent ?? 0) >= 60, (c) => `${n(c.f.systemFreePercent)}% of the system drive is empty. Minimalist, or afraid to install anything?`),
  e("sto-hdd", "storage", 3, (c) => c.f.systemDriveKind === "hdd", () => "Booting from a hard disk. The spinning platter has seen things."),
  e("sto-all-ssd", "storage", 3, (c) => c.f.ssdCount >= 4 && c.f.hddCount === 0, (c) => `${c.f.ssdCount} SSDs and zero spinning rust. That isn't storage, it's a lifestyle.`),
  e("sto-ssd", "storage", 2, (c) => c.f.systemDriveKind === "ssd", () => "System drive is an SSD. At least boot time isn't part of the problem."),
  e("sto-many", "storage", 3, (c) => (c.f.driveCount ?? 0) >= 5, (c) => `${c.f.driveCount} drives. Somewhere there's a folder called "misc" holding another folder called "misc".`),
  e("sto-tb", "storage", 3, (c) => (c.f.totalStorageTb ?? 0) >= 4, (c) => `${(c.f.totalStorageTb ?? 0).toFixed(1)} TB of storage. Impressive collection, questionable curation.`),
  e("sto-nearfull", "storage", 3, (c) => c.f.lowestFreePercent !== undefined && c.f.lowestFreePercent < 5, (c) => `One drive is at ${n(c.f.lowestFreePercent)}% free. That drive has seen things no SSD should witness.`),
  e("sto-apps", "storage", 2, (c) => (c.f.appCount ?? 0) >= 150, (c) => `${c.f.appCount} installed apps. "Just trying it out" became a lifestyle.`),
  e("sto-generic-1", "storage", 1, always, () => "Your storage has opinions about your download habits."),
  e("sto-generic-2", "storage", 1, always, () => "Free space is a feeling. Yours is mostly optimistic."),

  // ───────────────────────── GAMING ─────────────────────────
  e("gm-launchers3", "gaming", 3, (c) => c.f.launchers.length >= 3, (c) => `${c.f.launchers.length} game launchers installed. The backlog is older than the hardware.`),
  e("gm-launchers", "gaming", 2, (c) => c.f.launchers.length >= 1 && c.f.launchers.length < 3, (c) => `${c.f.launchers.join(" and ")} installed. A library bigger than your free time.`),
  e("gm-top", "gaming", 3, (c) => tier(c) >= 4, () => "Ready for any game on the shelf. The real bottleneck is your backlog."),
  e("gm-all", "gaming", 3, (c) => tier(c) === 5 && (c.s.gaming ?? 0) >= 90, (c) => `${gpu(c)} can run the lot. The question is whether you can pick one.`),
  e("gm-vram", "gaming", 3, (c) => (c.f.gpuVramGb ?? 99) < 8 && tier(c) >= 3, (c) => `${gpu(c)} has ${n(c.f.gpuVramGb)} GB of VRAM. Texture sliders will be a negotiation.`),
  e("gm-mid", "gaming", 2, (c) => tier(c) >= 2 && tier(c) <= 3, () => "Mid-range graphics. Welcome to the 'high settings but not ultra' club."),
  e("gm-low", "gaming", 2, (c) => tier(c) === 1, () => "Entry-level graphics. Esports titles and optimism will carry you."),
  e("gm-igpu", "gaming", 3, (c) => tier(c) === 0, () => "Gaming Readiness: 'solitaire, probably.' We believe in indie games."),
  e("gm-hdd", "gaming", 3, (c) => c.f.systemDriveKind === "hdd" && c.f.launchers.length > 0, () => "A game launcher on a hard disk. Loading screens are your new hobby."),
  e("gm-score", "gaming", 2, (c) => (c.s.gaming ?? 0) >= 90, (c) => `Gaming Readiness ${c.s.gaming}/100. If it can't run it, nobody can.`),
  e("gm-rgb", "gaming", 3, (c) => c.f.rgbApps.length >= 1 && tier(c) >= 3, () => "Gaming rig with its own lighting software. Frame rates are now proportional to vibes."),
  e("gm-generic-1", "gaming", 1, always, () => "Whether it can run it is one question. Whether you will finish it is another."),
  e("gm-generic-2", "gaming", 1, always, () => "Not a benchmark, just a vibe check. Verdict: playable."),

  // ───────────────────────── OVERALL ─────────────────────────
  e("ov-top", "overall", 2, (c) => (c.overall ?? 0) >= 90, (c) => `Score: ${c.overall}/100. Please stop, the other PCs can see you.`),
  e("ov-strong", "overall", 2, (c) => (c.overall ?? 0) >= 75 && (c.overall ?? 0) < 90, (c) => `Score: ${c.overall}/100. Strong, just not "post it on a forum" strong.`),
  e("ov-mid", "overall", 2, (c) => (c.overall ?? 0) >= 50 && (c.overall ?? 0) < 75, (c) => `Score: ${c.overall}/100. Passing grade, minimal glory.`),
  e("ov-low", "overall", 2, (c) => c.overall !== null && c.overall < 50, (c) => `Score: ${c.overall}/100. Still boots. That counts for something.`),
  e("ov-apps", "overall", 2, (c) => (c.f.appCount ?? 0) >= 150, (c) => `${c.f.appCount} apps installed. At some point "temporary" lost its meaning.`),
  e("ov-generic-1", "overall", 1, always, () => "We looked hard for something to roast. We found things."),
  e("ov-generic-2", "overall", 1, always, () => "This PC has secrets. They are now slightly less secret."),
  e("ov-generic-3", "overall", 1, always, () => "A fine machine. We'd say more but it's probably listening."),

  // personality-flavoured overall roasts
  e("pz-overkill-1", "overall", 3, (c) => c.personalityId === "overkill-machine", () => "This PC could simulate a small galaxy. It mostly opens Discord."),
  e("pz-overkill-2", "overall", 3, (c) => c.personalityId === "overkill-machine", () => "Your PC is powerful. Your use case hasn't caught up yet."),
  e("pz-gaming-1", "overall", 3, (c) => c.personalityId === "gaming-monster", () => "This PC was born to render. Spreadsheets are an insult to it."),
  e("pz-gaming-2", "overall", 3, (c) => c.personalityId === "gaming-monster", () => "All that power, and you'll probably replay the same three games."),
  e("pz-silent-1", "overall", 3, (c) => c.personalityId === "silent-killer", () => "Powerful, tidy and quiet. Basically the PC version of a ninja with a spreadsheet."),
  e("pz-silent-2", "overall", 3, (c) => c.personalityId === "silent-killer", () => "No clutter, no drama, serious hardware. Annoyingly well run."),
  e("pz-rgb-1", "overall", 3, (c) => c.personalityId === "rgb-addict", () => "Peak performance? Unknown. Peak glow? Documented."),
  e("pz-rgb-2", "overall", 3, (c) => c.personalityId === "rgb-addict", () => "Your PC doesn't run hot, it runs themed."),
  e("pz-budget-1", "overall", 3, (c) => c.personalityId === "budget-survivor", () => "Not the strongest, but it shows up every day. Respect."),
  e("pz-budget-2", "overall", 3, (c) => c.personalityId === "budget-survivor", () => "This PC has survived on determination and driver updates."),
  e("pz-work-1", "overall", 3, (c) => c.personalityId === "workhorse", () => "Quietly dependable. It does the job and never asks for applause."),
  e("pz-work-2", "overall", 3, (c) => c.personalityId === "workhorse", () => "Built for work, used for work, secretly also opens a lot of tabs."),
  e("pz-giant-1", "overall", 3, (c) => c.personalityId === "sleeping-giant", () => "A giant in a nap. A bit of housekeeping and it wakes up."),
  e("pz-giant-2", "overall", 3, (c) => c.personalityId === "sleeping-giant", () => "Your PC is powerful. Your housekeeping isn't."),
  e("pz-bottle-1", "overall", 3, (c) => c.personalityId === "bottleneck-victim", () => "One part is carrying the team. The others are on a group project."),
  e("pz-bottle-2", "overall", 3, (c) => c.personalityId === "bottleneck-victim", () => "Mismatched parts: the hardware equivalent of a duet with one singer."),
  e("pz-hoard-1", "overall", 3, (c) => c.personalityId === "storage-hoarder", () => "Everything is saved, nothing is organized. Archaeologists will love this."),
  e("pz-hoard-2", "overall", 3, (c) => c.personalityId === "storage-hoarder", () => "Delete something. We believe in you. Start small."),
  e("pz-clean-1", "overall", 3, (c) => c.personalityId === "clean-machine", () => "Clean, lean, well kept. Your PC has a skincare routine."),
  e("pz-clean-2", "overall", 3, (c) => c.personalityId === "clean-machine", () => "So tidy it's almost suspicious. Where are the 14 setup.exe files?"),
  e("pz-chaos-1", "overall", 3, (c) => c.personalityId === "chaos-engine", () => "It works, nobody knows why, and nobody dares to touch it."),
  e("pz-chaos-2", "overall", 3, (c) => c.personalityId === "chaos-engine", () => "Maximum entropy achieved. Frankly, impressive."),
  e("pz-office-1", "overall", 3, (c) => c.personalityId === "office-warrior", () => "Spreadsheets fear it. Games are scared of it for the wrong reasons."),
  e("pz-office-2", "overall", 3, (c) => c.personalityId === "office-warrior", () => "Built for emails, meetings and 47 browser tabs. A true professional."),
];
