import { PmProvider } from "./PmContext";

/** Wraps all Point Management pages with the shared PM context (identity + permissions). */
export default function PointManagementLayout({ children }: { children: React.ReactNode }) {
  return <PmProvider>{children}</PmProvider>;
}
