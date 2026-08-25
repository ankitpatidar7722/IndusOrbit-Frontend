"use client";
import { useParams, useRouter } from "next/navigation";
import { Page } from "indas-ui";
import ClientDetailBody from "../ClientDetailBody";

/**
 * Deep-link / direct-URL entry for a single client. The primary UX opens the same
 * content as a modal from the /clients grid (ClientDetailModal); this page renders
 * ClientDetailBody full-page for when someone lands on the URL directly.
 */
export default function ClientDetailPage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const id = params?.code ? decodeURIComponent(params.code) : "";
  return (
    <Page>
      <ClientDetailBody id={id} onClose={() => router.push("/clients")} />
    </Page>
  );
}
