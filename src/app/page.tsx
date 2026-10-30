"use client";
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Page, Tabs } from "indas-ui";
import { LayoutDashboard, UserPlus, CreditCard } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
import HomePhone from "@/components/phone/HomePhone";
import { customersApi, type CustomerCard } from "@/lib/customers";
import { crmApi, type CrmClient } from "@/lib/crm";
import OverviewTab from "@/components/dashboard/OverviewTab";
import OnboardingTab from "@/components/dashboard/OnboardingTab";
import SubscriptionsTab from "@/components/dashboard/SubscriptionsTab";

const DASH_TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "onboarding", label: "Onboarding", icon: UserPlus },
  { id: "subscriptions", label: "Subscriptions", icon: CreditCard },
];

/** Phone width (same 768px edge as indas-ui useDevice().isMobile). null until measured on the client. */
function usePhone(): boolean | null {
  const [phone, setPhone] = useState<boolean | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 768px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

export default function HomeRoute() {
  return (
    <Suspense fallback={<BrandedLoader size="lg" text="Loading…" />}>
      <HomeOrDashboard />
    </Suspense>
  );
}

/** "/" = the phone Home on a phone (app-style launcher), the company Dashboard everywhere else.
 *  On a phone the Dashboard opens from Home's "Dashboards" row as "/?tab=<id>". */
function HomeOrDashboard() {
  const phone = usePhone();
  const tabParam = useSearchParams().get("tab");
  if (phone === null) return <BrandedLoader size="lg" text="Loading…" />;
  if (phone && !tabParam) return <HomePhone />;
  return <DashboardPage initialTab={tabParam} />;
}

function DashboardPage({ initialTab }: { initialTab: string | null }) {
  const [tab, setTab] = useState(DASH_TABS.some((t) => t.id === initialTab) ? initialTab! : "overview");
  const [subs, setSubs] = useState<CustomerCard[]>([]);
  const [crm, setCrm] = useState<CrmClient[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real company-wide data: control-DB subscriptions + the internal CRM list.
    // CRM is best-effort (its endpoint may be missing on an un-redeployed backend).
    Promise.all([
      customersApi.list(),
      crmApi.clients().catch(() => [] as CrmClient[]),
    ])
      .then(([s, c]) => { setSubs(s); setCrm(c); })
      .catch((e) => setErr(String(e)))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <BrandedLoader size="lg" text="Loading dashboard…" />;

  return (
    <Page title="Dashboard" description="Company-wide overview">
      {err && (
        <div style={{ color: "#c0392b", marginBottom: 16 }}>
          Could not connect to the backend — is the API running? (http://localhost:5080)<br />
          <small style={{ opacity: 0.7 }}>{err}</small>
        </div>
      )}

      <div style={{ marginBottom: 18 }}>
        <Tabs tabs={DASH_TABS} activeTab={tab} onTabChange={setTab} variant="pill" size="md" />
      </div>

      {tab === "overview" && <OverviewTab subs={subs} crm={crm} />}
      {tab === "onboarding" && <OnboardingTab crm={crm} />}
      {tab === "subscriptions" && <SubscriptionsTab rows={subs} />}
    </Page>
  );
}
