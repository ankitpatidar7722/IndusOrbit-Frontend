import { redirect } from "next/navigation";

/** Canonical notifications page lives at /activity/notifications (matches the header
 *  "View History" link + the Parkson path). Keep /notifications working as a redirect. */
export default function NotificationsRedirect() {
  redirect("/activity/notifications");
}
