"use client";
import React, { useState, useEffect, useCallback } from "react";
import { X, Loader2, Search, Plus, Check, Trash2, Pencil } from "lucide-react";
import { messageFormatApi, type MessageFormatDto } from "@/lib/customers";

interface MessageFormatPopupProps {
  visible: boolean;
  onClose: () => void;
  onLoadMessage: (messageTitle: string, messageContent: string) => void;
}

const MessageFormatPopup: React.FC<MessageFormatPopupProps> = ({ visible, onClose, onLoadMessage }) => {
  const [messages, setMessages] = useState<MessageFormatDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [searchText, setSearchText] = useState("");

  const [formMode, setFormMode] = useState<"none" | "add" | "edit">("none");
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formEditId, setFormEditId] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await messageFormatApi.list();
      if (res.success) setMessages(res.data);
    } catch (e) {
      console.error("Failed to fetch message formats:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchMessages();
      setSelectedId(null);
      setSearchText("");
      setFormMode("none");
    }
  }, [visible, fetchMessages]);

  const selectedMessage = messages.find((m) => m.messageID === selectedId) || null;
  const filteredMessages = searchText.trim()
    ? messages.filter(
        (m) =>
          m.messageTitle.toLowerCase().includes(searchText.toLowerCase()) ||
          m.messageContent.toLowerCase().includes(searchText.toLowerCase())
      )
    : messages;

  const handleRowDblClick = (msg: MessageFormatDto) => {
    onLoadMessage(msg.messageTitle, msg.messageContent);
    onClose();
  };
  const handleLoadMessage = () => {
    if (selectedMessage) {
      onLoadMessage(selectedMessage.messageTitle, selectedMessage.messageContent);
      onClose();
    }
  };

  const openAddForm = () => { setFormMode("add"); setFormTitle(""); setFormContent(""); setFormEditId(null); };
  const openEditForm = (msg: MessageFormatDto) => { setFormMode("edit"); setFormTitle(msg.messageTitle); setFormContent(msg.messageContent); setFormEditId(msg.messageID); };
  const closeForm = () => { setFormMode("none"); setFormTitle(""); setFormContent(""); setFormEditId(null); };

  const handleSaveForm = async () => {
    if (!formTitle.trim() || !formContent.trim()) return;
    setIsSaving(true);
    try {
      const res = formMode === "add"
        ? await messageFormatApi.create({ messageTitle: formTitle.trim(), messageContent: formContent.trim(), isActive: true })
        : await messageFormatApi.update({ messageID: formEditId!, messageTitle: formTitle.trim(), messageContent: formContent.trim(), isActive: true });
      if (res.success) { closeForm(); await fetchMessages(); }
    } catch (e) {
      console.error("Failed to save message template:", e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteTemplate = async (messageId: number) => {
    try {
      const res = await messageFormatApi.remove(messageId);
      if (res.success) { if (selectedId === messageId) setSelectedId(null); await fetchMessages(); }
    } catch (e) {
      console.error("Failed to delete message template:", e);
    }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
      style={{ pointerEvents: "auto" }}
      // popup lives outside the (Radix) edit dialog; stop pointer/mouse-down from
      // bubbling to the document so Radix doesn't treat these clicks as an
      // "interact outside" and close the whole Edit modal.
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-100 overflow-hidden flex flex-col" style={{ maxHeight: "80vh", pointerEvents: "auto" }}>
        {/* Header — Indus 360 navy */}
        <div className="px-5 py-3.5 flex items-center justify-between" style={{ background: "linear-gradient(115deg,color-mix(in srgb, rgb(var(--color-primary)) 85%, black),rgb(var(--color-primary)))" }}>
          <div>
            <h2 className="text-base font-bold text-white">Select Message Format</h2>
            <p className="text-[11px] text-white/70 mt-0.5">Choose a predefined message template</p>
          </div>
          <button onClick={onClose} className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 text-white transition-all">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input type="text" placeholder="Search templates..." value={searchText} onChange={(e) => setSearchText(e.target.value)}
                className="w-full h-9 pl-9 pr-3 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/30 focus:border-[rgb(var(--color-primary))]" />
            </div>
            <span className="text-[12px] text-gray-400 whitespace-nowrap">{filteredMessages.length} template{filteredMessages.length !== 1 ? "s" : ""}</span>
            <button onClick={openAddForm} className="flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold text-[rgb(var(--color-primary))] bg-[#eef2f8] border border-[#c9d6e8] rounded-lg hover:bg-[#e2e9f3] transition-all whitespace-nowrap">
              <Plus className="w-3.5 h-3.5" /> Add Template
            </button>
          </div>

          {formMode !== "none" && (
            <div className="border border-[#c9d6e8] rounded-lg bg-[#f5f8fc] p-3 space-y-2">
              <p className="text-[11px] font-bold text-[rgb(var(--color-primary))] uppercase tracking-wider">{formMode === "add" ? "New Template" : "Edit Template"}</p>
              <input type="text" placeholder="Message Title" value={formTitle} onChange={(e) => setFormTitle(e.target.value)}
                className="w-full h-8 px-3 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/30 focus:border-[rgb(var(--color-primary))]" />
              <textarea placeholder="Message Content" value={formContent} onChange={(e) => setFormContent(e.target.value)} rows={3}
                className="w-full px-3 py-2 text-[13px] border border-gray-200 rounded-lg bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary))]/30 focus:border-[rgb(var(--color-primary))] resize-none" />
              <div className="flex gap-2 justify-end">
                <button onClick={closeForm} className="h-8 px-3 text-[12px] font-semibold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all">Cancel</button>
                <button onClick={handleSaveForm} disabled={!formTitle.trim() || !formContent.trim() || isSaving}
                  className="flex items-center gap-1 h-8 px-3 text-[12px] font-semibold text-white bg-[rgb(var(--color-primary))] rounded-lg hover:bg-[rgb(var(--color-primary-hover))] transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {formMode === "add" ? "Save" : "Update"}
                </button>
              </div>
            </div>
          )}

          {isLoading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-[rgb(var(--color-primary))]" />
              <span className="ml-2.5 text-[13px] text-gray-400">Loading templates...</span>
            </div>
          ) : filteredMessages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
              <Search className="w-10 h-10 text-gray-200 mb-3" />
              <p className="text-[13px] text-gray-400">No message templates found.</p>
              <p className="text-[11px] text-gray-300 mt-1">Click &quot;Add Template&quot; to create one.</p>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-white text-left" style={{ background: "color-mix(in srgb, rgb(var(--color-primary)) 85%, black)" }}>
                    <th className="px-4 py-2.5 font-semibold text-[12px] uppercase tracking-wider w-[200px]">Message Title</th>
                    <th className="px-4 py-2.5 font-semibold text-[12px] uppercase tracking-wider">Message Content</th>
                    <th className="px-2 py-2.5 w-[80px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMessages.map((msg) => {
                    const isSelected = selectedId === msg.messageID;
                    return (
                      <tr key={msg.messageID} onClick={() => setSelectedId(msg.messageID)} onDoubleClick={() => handleRowDblClick(msg)}
                        className={`cursor-pointer border-b border-gray-100 transition-all duration-150 ${isSelected ? "bg-[#e8eef6] border-l-4 border-l-[rgb(var(--color-primary))]" : "hover:bg-gray-50 border-l-4 border-l-transparent"}`}>
                        <td className={`px-4 py-2.5 ${isSelected ? "font-semibold text-[color-mix(in srgb, rgb(var(--color-primary)) 85%, black)]" : "text-gray-700"}`}>{msg.messageTitle}</td>
                        <td className={`px-4 py-2.5 ${isSelected ? "text-[rgb(var(--color-primary))]" : "text-gray-500"}`}>{msg.messageContent}</td>
                        <td className="px-2 py-2.5">
                          <div className="flex items-center gap-1 justify-center">
                            <button onClick={(e) => { e.stopPropagation(); openEditForm(msg); }} className="p-1.5 text-gray-400 hover:text-[rgb(var(--color-primary))] hover:bg-[#eef2f8] rounded transition-colors" title="Edit template">
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(msg.messageID); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors" title="Delete template">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-[11px] text-gray-400">Double-click a row to load directly</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all">
              <X className="w-3.5 h-3.5" /> Close
            </button>
            <button onClick={handleLoadMessage} disabled={!selectedMessage}
              className={`flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold rounded-lg transition-all duration-150 shadow-sm text-white ${selectedMessage ? "hover:opacity-90" : "opacity-50 cursor-not-allowed"}`}
              style={{ background: selectedMessage ? "linear-gradient(115deg,rgb(var(--color-primary)),color-mix(in srgb, rgb(var(--color-primary)) 85%, black))" : "#9aa6b5" }}>
              <Check className="w-4 h-4" /> Load Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageFormatPopup;
