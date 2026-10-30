"use client";
import { useMemo, useState } from "react";
import { Bell, ChevronLeft, ChevronRight, CircleUser, Hand, LogOut, Search, SearchX, SlidersHorizontal, Smartphone, X } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GESTURE_OPTIONS, setGesture, useGesturePrefs } from "@/lib/gesturePrefs";

/**
 * Settings on a phone, laid out like the phone's own Settings app (ported layout from IndusFlexoERP's
 * SettingsPhone):
 *   Home     account card (photo, name, email, Manage profile) · search · grouped rows (round tinted
 *            icon, label, one-line summary, chevron) · Logout on its own.
 *   Search   matches section names AND what is inside them; each result says which section it is in.
 *   Section  ‹ + section name, one line saying what it is for, then the page's existing content.
 * Only the frame is new — every section's content and handler stay settings/page.tsx's own.
 */
export type SettingsSectionId = "profile" | "notifications" | "preferences" | "gestures" | "bottomnav";

type Tone = "primary" | "error" | "orange" | "purple" | "teal";

interface SectionMeta {
  id: SettingsSectionId; label: string; icon: LucideIcon; tone: Tone;
  summary: string; description: string; items: string[];
}

export const SETTINGS_SECTIONS: SectionMeta[] = [
  {
    id: "profile", label: "Profile", icon: CircleUser, tone: "primary",
    summary: "Photo, signature, password and email",
    description: "Your personal details, sign-in password and the mail account the app sends from.",
    items: ["Photo", "Signature", "Full Name", "Email Address", "Reset Password", "Email Settings", "SMTP"],
  },
  {
    id: "notifications", label: "Notifications", icon: Bell, tone: "error",
    summary: "Message and email alerts",
    description: "Choose which alerts reach you.",
    items: ["Message notifications", "Email notifications", "Push notifications"],
  },
  {
    id: "preferences", label: "Display & theme", icon: SlidersHorizontal, tone: "orange",
    summary: "Text size, font, theme colours and login page",
    description: "How the app looks: font, text size, colours, dark mode and the login page design.",
    items: ["Font Family", "Font Size", "Text size", "Theme", "Colour", "Dark mode", "Login page", "Clear data"],
  },
  {
    id: "gestures", label: "Gestures", icon: Hand, tone: "purple",
    summary: "Swipes, hold and haptics",
    description: "Shortcuts you do with a swipe or a touch — turn any of them off here.",
    items: GESTURE_OPTIONS.map((g) => g.label).concat(["Haptics", "Vibration"]),
  },
  {
    id: "bottomnav", label: "Bottom bar", icon: Smartphone, tone: "teal",
    summary: "Shortcuts in the bottom navigation bar",
    description: "Pick up to four shortcuts for the bottom bar. Modules is always there.",
    items: ["Bottom Navbar", "Shortcuts"],
  },
];

const GROUPS: { title: string; ids: SettingsSectionId[] }[] = [
  { title: "Preferences", ids: ["notifications", "preferences", "gestures"] },
  { title: "App", ids: ["bottomnav"] },
];

const byId = (id: string) => SETTINGS_SECTIONS.find((s) => s.id === id);

function Row({ icon: Icon, tone, label, summary, danger, onClick }: {
  icon: LucideIcon; tone?: Tone; label: string; summary?: string; danger?: boolean; onClick: () => void;
}) {
  return (
    <button type="button" className="st-row" data-danger={danger || undefined} onClick={onClick}>
      <span className="st-row-icon" data-tone={danger ? "error" : tone}><Icon size={20} strokeWidth={2} /></span>
      <span style={{ minWidth: 0, flex: 1 }}>
        <span className="st-row-label">{label}</span>
        {summary && <span className="st-row-summary">{summary}</span>}
      </span>
      {!danger && <ChevronRight size={20} className="st-row-chevron" aria-hidden />}
    </button>
  );
}

export function SettingsPhoneHome({ onOpen, onLogout, userName, userEmail, photoUrl }: {
  onOpen: (id: SettingsSectionId) => void; onLogout: () => void;
  userName?: string; userEmail?: string; photoUrl?: string | null;
}) {
  const [q, setQ] = useState("");
  const [photoOk, setPhotoOk] = useState(true);
  const term = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!term) return [];
    const out: { key: string; section: SectionMeta; label: string; isSection: boolean }[] = [];
    for (const s of SETTINGS_SECTIONS) {
      if (s.label.toLowerCase().includes(term) || s.summary.toLowerCase().includes(term)) out.push({ key: s.id, section: s, label: s.label, isSection: true });
      for (const item of s.items) if (item.toLowerCase().includes(term)) out.push({ key: `${s.id}:${item}`, section: s, label: item, isSection: false });
    }
    return out;
  }, [term]);

  const initials = (userName || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");

  return (
    <div className="st-home">
      {!term && (
        <button type="button" className="st-account m-glass-card" onClick={() => onOpen("profile")}>
          <span className="st-avatar-ring">
            <span className="st-avatar">
              {photoUrl && photoOk
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photoUrl} alt="" onError={() => setPhotoOk(false)} />
                : initials || <CircleUser size={28} aria-hidden />}
            </span>
          </span>
          <span style={{ minWidth: 0, flex: 1 }}>
            <span className="st-account-name">{userName || "Profile"}</span>
            {userEmail && <span className="st-account-email">{userEmail}</span>}
            <span className="st-account-link">Manage profile <ChevronRight size={15} aria-hidden /></span>
          </span>
        </button>
      )}

      <label className="st-search">
        <Search size={18} style={{ flexShrink: 0, opacity: 0.55 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search settings" aria-label="Search settings" enterKeyHint="search" autoComplete="off" />
        {q && <button type="button" onClick={() => setQ("")} aria-label="Clear search" className="pl-clear"><X size={16} /></button>}
      </label>

      {term ? (
        results.length === 0 ? (
          <div className="st-empty"><SearchX size={28} aria-hidden /><div>No settings match</div><small>Try another word, like theme or password.</small></div>
        ) : (
          <div className="st-group">
            {results.map((r) => (
              <Row key={r.key} icon={r.section.icon} tone={r.section.tone} label={r.label}
                summary={r.isSection ? r.section.summary : r.section.label} onClick={() => onOpen(r.section.id)} />
            ))}
          </div>
        )
      ) : (
        <>
          {GROUPS.map(({ title, ids }) => (
            <section key={title}>
              <h2 className="st-group-title">{title}</h2>
              <div className="st-group">
                {ids.map((id) => { const s = byId(id)!; return <Row key={id} icon={s.icon} tone={s.tone} label={s.label} summary={s.summary} onClick={() => onOpen(id)} />; })}
              </div>
            </section>
          ))}
          <div className="st-group" style={{ marginTop: 20 }}>
            <Row danger icon={LogOut} label="Logout" onClick={onLogout} />
          </div>
        </>
      )}
    </div>
  );
}

/** Top of one section on a phone: ‹ title and a line saying what it is for. */
export function SettingsPhoneSectionHeader({ id, onBack }: { id: SettingsSectionId; onBack: () => void }) {
  const s = byId(id);
  return (
    <div className="st-section-head">
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button type="button" className="phone-icon-btn" onClick={onBack} aria-label="Back to settings"><ChevronLeft size={24} /></button>
        <h2 className="st-section-title">{s?.label ?? "Settings"}</h2>
      </div>
      {s && <p className="st-section-desc">{s.description}</p>}
    </div>
  );
}

/** Settings → Gestures: one switch per gesture (stored per device, lib/gesturePrefs). */
export function GestureSettings() {
  const prefs = useGesturePrefs();
  return (
    <div className="st-group">
      {GESTURE_OPTIONS.map((g) => {
        const on = prefs[g.id];
        return (
          <label key={g.id} className="st-toggle">
            <span style={{ minWidth: 0, flex: 1 }}>
              <span className="st-row-label">{g.label}</span>
              <span className="st-row-summary st-wrap">{g.description}</span>
            </span>
            <input type="checkbox" role="switch" checked={on} onChange={(e) => setGesture(g.id, e.target.checked)} className="st-switch" aria-label={g.label} />
          </label>
        );
      })}
    </div>
  );
}
