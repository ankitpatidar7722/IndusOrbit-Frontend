// Messaging (chat) API client for Indus 360 — talks to the .NET MessagingController.
// Migrated from the legacy Parkson messaging API; same types + method shapes, but
// implemented with Indus 360's fetch + UserID/CompanyID header auth.

const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5080";

// ─── Types (match the backend PascalCase DTOs) ───────────────────────────────
export interface ChatRoom {
  RoomID: number;
  CompanyID: number;
  Type: "DM" | "Group" | "Channel";
  Name: string | null;
  Description: string | null;
  AvatarUrl: string | null;
  IsPublic: boolean;
  IsReadOnly: boolean;
  CreatedBy: number;
  CreatedDate: string;
  UpdatedDate: string;
  LastMessageAt: string | null;
  LastMessagePreview: string | null;
  LastMessageBy: number | null;
  IsArchived: boolean;
  IsDeleted: boolean;
  Participants: string | null; // JSON string
  UnreadCount?: number;
}
export interface ChatMessage {
  MessageID: number;
  RoomID: number;
  CompanyID: number;
  UserID: number;
  Content: string | null;
  MessageType: "Text" | "File" | "Image" | "System";
  ParentMessageID: number | null;
  ReplyDepth: number;
  ReplyCount: number;
  CreatedAt: string;
  EditedAt: string | null;
  IsEdited: boolean;
  IsDeleted: boolean;
  Reactions: string | null;
  Attachments: string | null;
  IsPinned?: boolean;
  PinnedBy?: number | null;
  IsStarred?: boolean;
  UserName?: string;
  RoomName?: string;
  RoomType?: string;
}
export interface ChatParticipant {
  userId: number;
  userName: string;
  role: "Owner" | "Admin" | "Member";
  lastReadMessageId: number | null;
  lastReadAt: string | null;
  isMuted: boolean;
  joinedAt: string;
}
export interface ChatReaction { emoji: string; userIds: number[] }
export interface ChatAttachment { fileName: string; fileUrl: string; fileSize: number; mimeType: string }
export interface ChatContact { UserID: number; UserName: string; Designation: string | null; Email: string | null }
export interface UnreadCount { RoomID: number; UnreadCount: number }

export interface CreateRoomRequest { Type: "Group" | "Channel"; Name: string; Description?: string; IsPublic?: boolean; IsReadOnly?: boolean; ParticipantsJson: string }
export interface CreateDMRequest { TargetUserID: number; TargetUserName: string }
export interface SendMessageRequest { Content?: string; MessageType?: string; ParentMessageID?: number; AttachmentsJson?: string }
export interface UpdateRoomRequest { Name?: string; Description?: string; IsPublic?: boolean; IsReadOnly?: boolean; ParticipantsJson?: string }

export interface APIResponse<T> { success: boolean; data?: T; error?: string }

// ─── Helpers ─────────────────────────────────────────────────────────────────
export function parseParticipants(json: string | null): ChatParticipant[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
export function parseReactions(json: string | null): ChatReaction[] { if (!json) return []; try { return JSON.parse(json); } catch { return []; } }
export function parseAttachments(json: string | null): ChatAttachment[] {
  if (!json) return [];
  try {
    const raw = JSON.parse(json);
    if (!Array.isArray(raw)) return [];
    // Normalize (tolerate PascalCase / partial legacy data) and drop empty entries.
    return raw
      .map((a: any): ChatAttachment => ({
        fileName: a?.fileName ?? a?.FileName ?? '',
        fileUrl: a?.fileUrl ?? a?.FileUrl ?? '',
        fileSize: Number(a?.fileSize ?? a?.FileSize ?? 0),
        mimeType: a?.mimeType ?? a?.MimeType ?? '',
      }))
      .filter((a) => a.fileUrl || a.fileName);
  } catch {
    return [];
  }
}

// Loose: the caller passes the next-auth Session; we only read user.UserID/CompanyID.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Session = any;
function ids(session: Session) {
  const u = session?.user ?? {};
  return { userId: u.UserID ?? u.userID ?? 0, companyId: u.CompanyID ?? u.companyID ?? 1 };
}
function hdrs(session: Session): Record<string, string> {
  const { userId, companyId } = ids(session);
  return { "Content-Type": "application/json", UserID: String(userId), CompanyID: String(companyId) };
}
async function req<T>(method: string, path: string, session: Session, body?: unknown): Promise<APIResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, { method, headers: hdrs(session), body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
    if (!res.ok) return { success: false, error: `${res.status} ${res.statusText}` };
    const data = res.status === 204 ? undefined : await res.json();
    return { success: true, data: data as T };
  } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Request failed" }; }
}

// ─── API ─────────────────────────────────────────────────────────────────────
class MessagingAPI {
  static getConversations(session: Session, type?: "DM" | "Group" | "Channel") {
    return req<ChatRoom[]>("GET", `/api/messaging/conversations${type ? `?type=${type}` : ""}`, session).then((r) => ({ ...r, data: r.data ?? [] }));
  }
  static createRoom(request: CreateRoomRequest, session: Session) { return req<ChatRoom>("POST", "/api/messaging/conversations", session, request); }
  static getOrCreateDM(request: CreateDMRequest, session: Session) { return req<ChatRoom>("POST", "/api/messaging/conversations/dm", session, request); }
  static updateRoom(roomId: number, request: UpdateRoomRequest, session: Session) { return req<ChatRoom>("POST", `/api/messaging/conversations/${roomId}/update`, session, request); }
  static getMessages(roomId: number, session: Session, page = 1, pageSize = 50) {
    return req<ChatMessage[]>("GET", `/api/messaging/conversations/${roomId}/messages?page=${page}&pageSize=${pageSize}`, session).then((r) => ({ ...r, data: r.data ?? [] }));
  }
  static sendMessage(roomId: number, request: SendMessageRequest, session: Session) { return req<ChatMessage>("POST", `/api/messaging/conversations/${roomId}/messages`, session, request); }
  static editMessage(messageId: number, content: string, session: Session) { return req<ChatMessage>("POST", `/api/messaging/messages/${messageId}/edit`, session, { Content: content }); }
  static deleteMessage(messageId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/messages/${messageId}/delete`, session, {}); }
  static getThreadReplies(messageId: number, session: Session) {
    return req<ChatMessage[]>("GET", `/api/messaging/messages/${messageId}/replies`, session).then((r) => ({ ...r, data: r.data ?? [] }));
  }
  static replyToMessage(parentMessageId: number, request: SendMessageRequest, session: Session) { return req<ChatMessage>("POST", `/api/messaging/messages/${parentMessageId}/replies`, session, request); }
  static updateReactions(messageId: number, reactionsJson: string, session: Session) { return req<ChatMessage>("POST", `/api/messaging/messages/${messageId}/reactions`, session, { ReactionsJson: reactionsJson }); }
  static markAsRead(roomId: number, lastReadMessageId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/read`, session, { LastReadMessageID: lastReadMessageId }); }
  static pinMessage(messageId: number, isPinned: boolean, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/messages/${messageId}/pin`, session, { IsPinned: isPinned }); }
  static starMessage(messageId: number, isStarred: boolean, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/messages/${messageId}/star`, session, { IsStarred: isStarred }); }
  static deleteForMe(messageId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/messages/${messageId}/delete-for-me`, session, {}); }
  static getPinned(roomId: number, session: Session) { return req<ChatMessage[]>("GET", `/api/messaging/conversations/${roomId}/pinned`, session).then((r) => ({ ...r, data: r.data ?? [] })); }
  // ── Group management ──
  static addMembers(roomId: number, members: { UserID: number; UserName: string }[], session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/members`, session, { Members: members }); }
  static removeMember(roomId: number, targetUserId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/members/${targetUserId}/remove`, session, {}); }
  static leaveGroup(roomId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/leave`, session, {}); }
  static setGroupReadOnly(roomId: number, isReadOnly: boolean, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/settings`, session, { IsReadOnly: isReadOnly }); }
  static setMemberRole(roomId: number, targetUserId: number, role: "Admin" | "Member", session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/members/${targetUserId}/role`, session, { Role: role }); }
  static deleteRoom(roomId: number, session: Session) { return req<{ Message: string }>("POST", `/api/messaging/conversations/${roomId}/delete`, session, {}); }
  static getUnreadCounts(session: Session) { return req<UnreadCount[]>("GET", "/api/messaging/unread-counts", session).then((r) => ({ ...r, data: r.data ?? [] })); }
  static getOnlineUsers(session: Session) { return req<string[]>("GET", "/api/messaging/online-users", session).then((r) => ({ ...r, data: r.data ?? [] })); }
  static getLastSeen(userId: number, session: Session) { return req<{ userId: number; isOnline: boolean; lastSeenAt: string | null }>("GET", `/api/messaging/last-seen/${userId}`, session); }
  static searchMessages(query: string, session: Session, limit = 50) {
    return req<ChatMessage[]>("GET", `/api/messaging/search?q=${encodeURIComponent(query)}&limit=${limit}`, session).then((r) => ({ ...r, data: r.data ?? [] }));
  }
  static getContacts(session: Session) { return req<ChatContact[]>("GET", "/api/messaging/contacts", session).then((r) => ({ ...r, data: r.data ?? [] })); }
  static async uploadFile(file: File, session: Session): Promise<APIResponse<{ FileName: string; FileUrl: string; FileSize: number; MimeType: string }>> {
    try {
      const { userId, companyId } = ids(session);
      const fd = new FormData(); fd.append("file", file);
      const res = await fetch(`${BASE}/api/messaging/upload`, { method: "POST", body: fd, headers: { UserID: String(userId), CompanyID: String(companyId) } });
      if (!res.ok) return { success: false, error: `Upload failed: ${res.status}` };
      // The upload endpoint serializes camelCase (anonymous object, no [JsonPropertyName]),
      // but every caller reads PascalCase — normalize so file + voice-note attachments keep their url/name/size.
      const raw = await res.json();
      const data = {
        FileName: raw?.FileName ?? raw?.fileName ?? file.name,
        FileUrl: raw?.FileUrl ?? raw?.fileUrl ?? "",
        FileSize: Number(raw?.FileSize ?? raw?.fileSize ?? file.size ?? 0),
        MimeType: raw?.MimeType ?? raw?.mimeType ?? file.type ?? "application/octet-stream",
      };
      return { success: true, data };
    } catch (e) { return { success: false, error: e instanceof Error ? e.message : "Upload failed" }; }
  }
}

export default MessagingAPI;
export { MessagingAPI };
