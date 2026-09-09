"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { SessionProvider, useSession } from "next-auth/react";
import {
  ThemeProvider, QueryProvider, DeviceProvider, AppConfigProvider,
  LanguageProvider, CurrencyProvider, TooltipProvider, GlobalAlertProvider,
  PageTitleProvider, SearchPreferencesProvider, AppShell,
} from "indas-ui";
import BrandedLoader from "@/components/BrandedLoader";
import { setCurrentUserId } from "@/lib/currentUser";
import TopHeader from "@/components/TopHeader";
import { EmailComposerProvider } from "@/components/email/EmailComposerProvider";
import { MessagingPanelProvider } from "@/components/messaging/MessagingPanelProvider";
import { NotificationsProvider } from "@/contexts/NotificationsContext";
import NotificationToaster from "@/components/NotificationToaster";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import MobileNav from "@/components/MobileNav";
import BottomNav from "@/components/BottomNav";
import PullToRefresh from "@/components/PullToRefresh";
import RouteAccessGuard from "@/components/RouteAccessGuard";

/**
 * Renders the app shell (with the DB-driven sidebar) only when authenticated.
 * The /login route renders bare (no shell). Unauthenticated users are bounced
 * to /login. The sidebar's companyId/userId come from the logged-in session,
 * which is what indas-ui's DynamicSidebar uses to fetch the per-user menu.
 */
function Shell({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  // Bare routes render outside the next-auth gate + AppShell: the unified /login
  // (premium sign-in for both employees and admins), and the /employee HR profile
  // page (localStorage session for employees without an Indus360 app account).
  const bare = pathname === "/login" || pathname.startsWith("/employee");

  useEffect(() => {
    if (status === "unauthenticated" && !bare) {
      router.replace("/login");
    }
  }, [status, bare, router]);
  // Make the logged-in user's id available to the API fetch helpers (audit columns).
  useEffect(() => {
    setCurrentUserId((session?.user as { UserID?: number } | undefined)?.UserID);
  }, [session]);

  // Bare screens: no shell, no next-auth gate.
  if (bare) return <>{children}</>;

  if (status === "loading") return <BrandedLoader overlay text="Loading…" />;
  if (status !== "authenticated") return null; // redirecting to /login

  const u = session.user as unknown as { CompanyID: number; UserID: number };
  // Set synchronously (not only in the effect above) so it's ready BEFORE child pages mount and
  // fire their fetch effects — otherwise /clients' first load could miss the UserID header and
  // fall back to the unscoped (all-clients) response.
  setCurrentUserId(u.UserID);
  return (
    <NotificationsProvider>
      <EmailComposerProvider>
        <MessagingPanelProvider>
          <div className="app-frame" style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
            <MobileNav companyId={u.CompanyID} userId={u.UserID} />
            <TopHeader />
            <div style={{ flex: 1, minHeight: 0 }}>
              <AppShell sidebar={{ companyId: u.CompanyID, userId: u.UserID }}>
                <RouteAccessGuard>{children}</RouteAccessGuard>
              </AppShell>
            </div>
            {/* Native-app bottom navigation — mobile only (hidden ≥ lg via CSS). */}
            <BottomNav />
          </div>
          {/* Pull-down-to-refresh (touch devices only). */}
          <PullToRefresh />
          <NotificationToaster />
        </MessagingPanelProvider>
      </EmailComposerProvider>
    </NotificationsProvider>
  );
}

/** All indas-ui providers + next-auth session, in one client wrapper. */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ServiceWorkerRegister />
      <ThemeProvider defaultTheme={{ variant: "default", mode: "light" }} enableSystem>
        <QueryProvider>
          <DeviceProvider>
            <AppConfigProvider>
              <LanguageProvider>
                <CurrencyProvider baseCurrencyCode="INR">
                  <TooltipProvider delayDuration={200}>
                    <GlobalAlertProvider>
                      <PageTitleProvider>
                        <SearchPreferencesProvider>
                          <Shell>{children}</Shell>
                        </SearchPreferencesProvider>
                      </PageTitleProvider>
                    </GlobalAlertProvider>
                  </TooltipProvider>
                </CurrencyProvider>
              </LanguageProvider>
            </AppConfigProvider>
          </DeviceProvider>
        </QueryProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
