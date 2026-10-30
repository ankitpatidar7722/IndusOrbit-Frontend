"use client";
import { useContext, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ThemeContext } from "indas-ui";
import { BookOpen, CalendarDays, ChevronRight, LogOut, Mail, Moon, Settings as SettingsIcon, ShieldCheck, Sun, User as UserIcon } from "lucide-react";
import { signOutTracked } from "@/lib/sessionTracking";
import { photoUrl } from "@/lib/users";
import { useBackGuard } from "@/lib/back-stack";

/**
 * Phone profile card (IndusFlexoERP style), opened from the top bar's avatar over a dimmed screen:
 *
 *   (photo)  Ankit Patidar  [Admin]
 *            ankit@…
 *   [ Financial year 2026-27 ] [ Theme  Light ▸ ]
 *   Email                                    ›
 *   User Manual                              ›
 *   [ ⚙ Settings ]        [ ⎋ Log Out ]
 *            Signed in for 2h 23m
 */
export default function ProfileCard({ open, onClose, onOpenManual }: { open: boolean; onClose: () => void; onOpenManual: () => void }) {
  const router = useRouter();
  const { data: session } = useSession();
  const u = (session?.user ?? {}) as { name?: string; email?: string; UserID?: number; Role?: string; FYear?: string; LoginAt?: number };
  const themeCtx = useContext(ThemeContext);
  const isDark = !!themeCtx?.isDark;
  const [photoOk, setPhotoOk] = useState(true);
  useBackGuard(open, onClose);   // Android / browser Back closes the card

  if (!open) return null;
  const go = (href: string) => { onClose(); router.push(href); };
  const initials = (u.name || "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const signedIn = (() => {
    if (!u.LoginAt) return null;
    const mins = Math.max(0, Math.floor((new Date().getTime() - u.LoginAt) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h ? `${h}h ${m}m` : `${m}m`;
  })();

  return (
    <div className="pc-backdrop" onClick={onClose}>
      <div className="pc-card" role="dialog" aria-modal="true" aria-label="Profile" onClick={(e) => e.stopPropagation()}>
        <div className="pc-head">
          <span className="st-avatar-ring">
            <span className="st-avatar" style={{ width: 52, height: 52, fontSize: 18 }}>
              {u.UserID && photoOk
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={photoUrl(u.UserID)} alt="" onError={() => setPhotoOk(false)} />
                : initials || <UserIcon size={24} aria-hidden />}
            </span>
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="pc-name-row">
              <span className="pc-name">{u.name || "User"}</span>
              {u.Role && <span className="pc-role"><ShieldCheck size={11} aria-hidden /> {u.Role}</span>}
            </div>
            {u.email && <div className="pc-email">{u.email}</div>}
          </div>
        </div>

        <div className="pc-tiles">
          <div className="pc-tile">
            <span className="pc-tile-icon" data-tone="teal"><CalendarDays size={17} /></span>
            <span style={{ minWidth: 0 }}><span className="pc-tile-label">Financial year</span><span className="pc-tile-value">{u.FYear || "—"}</span></span>
          </div>
          <button type="button" className="pc-tile" onClick={() => themeCtx?.toggleMode()} aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}>
            <span className="pc-tile-icon" data-tone="primary">{isDark ? <Moon size={17} /> : <Sun size={17} />}</span>
            <span style={{ minWidth: 0 }}><span className="pc-tile-label">Theme</span><span className="pc-tile-value">{isDark ? "Dark" : "Light"} <ChevronRight size={13} aria-hidden /></span></span>
          </button>
        </div>

        <div className="pc-list">
          <button type="button" className="pc-row" onClick={() => go("/email")}>
            <span className="pc-tile-icon" data-tone="primary"><Mail size={17} /></span><span className="pc-row-label">Email</span><ChevronRight size={18} className="st-row-chevron" />
          </button>
          <button type="button" className="pc-row" onClick={() => { onClose(); onOpenManual(); }}>
            <span className="pc-tile-icon" data-tone="orange"><BookOpen size={17} /></span><span className="pc-row-label">User Manual</span><ChevronRight size={18} className="st-row-chevron" />
          </button>
        </div>

        <div className="pc-actions">
          <button type="button" className="pc-btn" onClick={() => go("/settings")}><SettingsIcon size={17} /> Settings</button>
          <button type="button" className="pc-btn pc-btn-danger" onClick={() => signOutTracked()}><LogOut size={17} /> Log Out</button>
        </div>
        {signedIn && <div className="pc-foot">Signed in for {signedIn}</div>}
      </div>
    </div>
  );
}
