'use client'

import { MessagingPanelContent } from '@/components/messaging/messaging-panel-content'

/**
 * Full-screen Messages page.
 *
 * Renders the SAME two-pane "Chats / Groups" messenger as the header slide-in
 * panel (MessagingPanelContent) so the full view and the popup look identical —
 * it just fills the whole content area instead of a narrow side panel. The
 * maximize button in MessagingPanelProvider navigates here, and /messages
 * redirects here, so both routes now show the popup's layout.
 *
 * (MessagingProvider is supplied app-wide by MessagingPanelProvider in
 * app/providers.tsx, so useMessaging() inside the content works here too.)
 */
export default function MessagesPage() {
  // h-full of the app's <main> (between the header and the bottom bar) — a 100vh-based height put
  // the message composer under the phone's bottom bar.
  return (
    <div className="h-full flex flex-col">
      <MessagingPanelContent onClose={() => {}} />
    </div>
  )
}
