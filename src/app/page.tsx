"use client";
import { useEffect, useState } from "react";
import { Page, Tabs } from "indas-ui";
import { LayoutDashboard, UserPlus, CreditCard } from "lucide-react";
import BrandedLoader from "@/components/BrandedLoader";
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

export default function DashboardPage() {
  const [tab, setTab] = useState("overview");
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
          Backend se connect nahi hua — API chal raha hai? (http://localhost:5080)<br />
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
