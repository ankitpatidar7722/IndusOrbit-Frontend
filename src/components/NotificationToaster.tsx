"use client";
import { useRouter } from "next/navigation";
import { MessageSquare, Mail, Bell, X } from "lucide-react";
import { useNotifications } from "@/contexts/NotificationsContext";
import type { AppNotification } from "@/lib/notifications";

const COLORS = ["#2563eb", "#059669", "#7c3aed", "#d97706", "#e11d48", "#0891b2", "#4f46e5", "#0d9488"];
function color(key: string) {
  let h = 0; for (let i = 0; i < key.length; i++) h = key.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}
function TypeIcon({ type }: { type: AppNotification["Type"] }) {
  if (type === "Email") return <Mail className="w-3 h-3" />;
  if (type === "Message") return <MessageSquare className="w-3 h-3" />;
  return <Bell className="w-3 h-3" />;
}

/** WhatsApp-style notification toasts — top-right stack, click to open, auto-dismiss. */
export default function NotificationToaster() {
  const { toasts, dismissToast, markRead } = useNotifications();
  const router = useRouter();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-16 right-4 z-[100] flex flex-col gap-2 w-[22rem] max-w-[calc(100vw-2rem)] pointer-events-none">
      {toasts.map(({ id, notification: n }) => {
        const initials = (n.IconKey || (n.Title || "?").slice(0, 2)).toUpperCase();
        const open = () => {
          markRead(n.NotificationID);
          if (n.Link) router.push(n.Link);
          dismissToast(id);
        };
        return (
          <div
            key={id}
            onClick={open}
            role="button"
            className="pointer-events-auto cursor-pointer flex items-start gap-3 p-3 rounded-xl bg-[rgb(var(--bg-surface))] border border-[rgb(var(--bd-default))] shadow-xl"
            style={{ animation: "indusToastIn .22s ease-out" }}
          >
            {/* Avatar + type badge */}
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-semibold" style={{ background: color(initials) }}>
                {initials}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[rgb(var(--color-primary))] text-white flex items-center justify-center border-2 border-[rgb(var(--bg-surface))]">
                <TypeIcon type={n.Type} />
              </span>
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[rgb(var(--fg-default))] truncate">{n.Title || (n.Type === "Email" ? "New email" : "New message")}</p>
              <p className="text-xs text-[rgb(var(--fg-muted))] line-clamp-2 mt-0.5 break-words">{n.Body}</p>
            </div>

            {/* Dismiss */}
            <button
              onClick={(e) => { e.stopPropagation(); dismissToast(id); }}
              className="flex-shrink-0 text-[rgb(var(--fg-muted))] hover:text-[rgb(var(--fg-default))]"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
