// Shared UI helpers.
export type BadgeVariant =
  | "default" | "secondary" | "success" | "warning" | "destructive" | "info" | "amber"
  // extra indas-ui Badge colours (used to give each distinct status its own colour)
  | "danger" | "orange" | "cyan" | "indigo" | "lime" | "pink" | "purple" | "teal" | "violet" | "emerald" | "sky" | "rose";

/** Map a domain status to an indas-ui Badge variant. */
export function statusVariant(s: string): BadgeVariant {
  switch (s) {
    case "Complete": return "success";
    case "Go-Live": return "warning";
    case "Training":
    case "In Progress": return "info";
    case "Open": return "warning";
    case "Pending Kick-Off": return "amber";
    case "Provisioning":
    case "Support":
    case "Pending":
    case "Planned":
    case "Ongoing":
    case "Running":
    default: return "secondary";
  }
}

/** Subscription status → Badge variant. */
export function subscriptionVariant(s?: string | null): BadgeVariant {
  switch ((s || "").toLowerCase()) {
    case "active": return "success";
    case "expired": return "destructive";
    default: return "secondary";
  }
}
