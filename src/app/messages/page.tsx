import { redirect } from "next/navigation";

/** Canonical messaging route is /activity/messages (matches the legacy path the
 *  panel + components navigate to). Keep /messages working as a redirect. */
export default function MessagesRedirect() {
  redirect("/activity/messages");
}
