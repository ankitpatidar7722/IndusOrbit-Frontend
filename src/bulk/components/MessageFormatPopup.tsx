import React, { useState, useEffect, useCallback } from 'react';
import { X, Loader2, Search, Plus, Check, Trash2, Pencil } from 'lucide-react';
import {
    getMessageFormats,
    createMessageFormat,
    updateMessageFormat,
    deleteMessageFormat,
    MessageFormatDto,
} from '../services/api';

interface MessageFormatPopupProps {
    visible: boolean;
    onClose: () => void;
    onLoadMessage: (messageTitle: string, messageContent: string) => void;
}

const MessageFormatPopup: React.FC<MessageFormatPopupProps> = ({ visible, onClose, onLoadMessage }) => {
    const [messages, setMessages] = useState<MessageFormatDto[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [searchText, setSearchText] = useState('');

    // Add / Edit form state
    const [formMode, setFormMode] = useState<'none' | 'add' | 'edit'>('none');
    const [formTitle, setFormTitle] = useState('');
    const [formContent, setFormContent] = useState('');
    const [formEditId, setFormEditId] = useState<number | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fetchMessages = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await getMessageFormats();
            if (response.success) {
                setMessages(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch message formats:', error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (visible) {
            fetchMessages();
            setSelectedId(null);
            setSearchText('');
            setFormMode('none');
        }
    }, [visible, fetchMessages]);

    const selectedMessage = messages.find(m => m.messageID === selectedId) || null;

    const filteredMessages = searchText.trim()
        ? messages.filter(m =>
            m.messageTitle.toLowerCase().includes(searchText.toLowerCase()) ||
            m.messageContent.toLowerCase().includes(searchText.toLowerCase())
        )
        : messages;

    const handleRowClick = (msg: MessageFormatDto) => {
        setSelectedId(msg.messageID);
    };

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

    const openAddForm = () => {
        setFormMode('add');
        setFormTitle('');
        setFormContent('');
        setFormEditId(null);
    };

    const openEditForm = (msg: MessageFormatDto) => {
        setFormMode('edit');
        setFormTitle(msg.messageTitle);
        setFormContent(msg.messageContent);
        setFormEditId(msg.messageID);
    };

    const closeForm = () => {
        setFormMode('none');
        setFormTitle('');
        setFormContent('');
        setFormEditId(null);
    };

    const handleSaveForm = async () => {
        if (!formTitle.trim() || !formContent.trim()) return;
        setIsSaving(true);
        try {
            if (formMode === 'add') {
                const response = await createMessageFormat({
                    messageTitle: formTitle.trim(),
                    messageContent: formContent.trim(),
                    isActive: true,
                });
                if (response.success) {
                    closeForm();
                    await fetchMessages();
                }
            } else if (formMode === 'edit' && formEditId) {
                const response = await updateMessageFormat({
                    messageID: formEditId,
                    messageTitle: formTitle.trim(),
                    messageContent: formContent.trim(),
                    isActive: true,
                });
                if (response.success) {
                    closeForm();
                    await fetchMessages();
                }
            }
        } catch (error) {
            console.error('Failed to save message template:', error);
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteTemplate = async (messageId: number) => {
        try {
            const response = await deleteMessageFormat(messageId);
            if (response.success) {
                if (selectedId === messageId) setSelectedId(null);
                await fetchMessages();
            }
        } catch (error) {
            console.error('Failed to delete message template:', error);
        }
    };

    if (!visible) return null;

    return (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.15s ease-out' }}>
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col"
                style={{ maxHeight: '80vh' }}>

                {/* Header */}
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-3.5 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-white">Select Message Format</h2>
                        <p className="text-[11px] text-amber-100 mt-0.5">Choose a predefined message template</p>
                    </div>
                    <button onClick={onClose}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col p-4 gap-3">
                    {/* Action bar */}
                    <div className="flex items-center gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search templates..."
                                value={searchText}
                                onChange={e => setSearchText(e.target.value)}
                                className="w-full h-9 pl-9 pr-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                            />
                        </div>
                        <span className="text-[12px] text-gray-400 dark:text-gray-500 whitespace-nowrap">
                            {filteredMessages.length} template{filteredMessages.length !== 1 ? 's' : ''}
                        </span>
                        <button
                            onClick={openAddForm}
                            className="flex items-center gap-1.5 h-9 px-3 text-[12px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/40 rounded-lg hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-all whitespace-nowrap"
                        >
                            <Plus className="w-3.5 h-3.5" /> Add Template
                        </button>
                    </div>

                    {/* Add / Edit form */}
                    {formMode !== 'none' && (
                        <div className="border border-amber-200 dark:border-amber-700/40 rounded-lg bg-amber-50/50 dark:bg-amber-900/10 p-3 space-y-2">
                            <p className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                                {formMode === 'add' ? 'New Template' : 'Edit Template'}
                            </p>
                            <input
                                type="text"
                                placeholder="Message Title"
                                value={formTitle}
                                onChange={e => setFormTitle(e.target.value)}
                                className="w-full h-8 px-3 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
                            />
                            <textarea
                                placeholder="Message Content"
                                value={formContent}
                                onChange={e => setFormContent(e.target.value)}
                                rows={3}
                                className="w-full px-3 py-2 text-[13px] border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                                <button onClick={closeForm}
                                    className="h-8 px-3 text-[12px] font-semibold text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all">
                                    Cancel
                                </button>
                                <button onClick={handleSaveForm}
                                    disabled={!formTitle.trim() || !formContent.trim() || isSaving}
                                    className="flex items-center gap-1 h-8 px-3 text-[12px] font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    {formMode === 'add' ? 'Save' : 'Update'}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Table */}
                    {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                            <span className="ml-2.5 text-[13px] text-gray-400">Loading templates...</span>
                        </div>
                    ) : filteredMessages.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
                            <Search className="w-10 h-10 text-gray-200 dark:text-gray-700 mb-3" />
                            <p className="text-[13px] text-gray-400 dark:text-gray-500">No message templates found.</p>
                            <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Click "Add Template" to create one.</p>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-gray-200 dark:border-gray-700">
                            <table className="w-full text-[13px]">
                                <thead>
                                    <tr className="bg-gray-800 dark:bg-gray-800 text-white text-left">
                                        <th className="px-4 py-2.5 font-semibold text-[12px] uppercase tracking-wider w-[200px]">Message Title</th>
                                        <th className="px-4 py-2.5 font-semibold text-[12px] uppercase tracking-wider">Message Content</th>
                                        <th className="px-2 py-2.5 w-[80px]"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredMessages.map((msg) => {
                                        const isSelected = selectedId === msg.messageID;
                                        return (
                                            <tr
                                                key={msg.messageID}
                                                onClick={() => handleRowClick(msg)}
                                                onDoubleClick={() => handleRowDblClick(msg)}
                                                className={`cursor-pointer border-b border-gray-100 dark:border-gray-800 transition-all duration-150
                                                    ${isSelected
                                                        ? 'bg-amber-100 dark:bg-amber-900/30 border-l-4 border-l-amber-500'
                                                        : 'hover:bg-gray-50 dark:hover:bg-gray-800/50 border-l-4 border-l-transparent'
                                                    }`}
                                            >
                                                <td className={`px-4 py-2.5 ${isSelected ? 'font-semibold text-amber-800 dark:text-amber-300' : 'text-gray-700 dark:text-gray-300'}`}>
                                                    {msg.messageTitle}
                                                </td>
                                                <td className={`px-4 py-2.5 ${isSelected ? 'text-amber-700 dark:text-amber-200' : 'text-gray-500 dark:text-gray-400'}`}>
                                                    {msg.messageContent}
                                                </td>
                                                <td className="px-2 py-2.5">
                                                    <div className="flex items-center gap-1 justify-center">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); openEditForm(msg); }}
                                                            className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                                            title="Edit template"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(msg.messageID); }}
                                                            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                                            title="Delete template"
                                                        >
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

                {/* Footer with Load Message button */}
                <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">Double-click a row to load directly</p>
                    <div className="flex items-center gap-2">
                        <button onClick={onClose}
                            className="flex items-center gap-1.5 h-9 px-4 text-[13px] font-semibold text-gray-600 dark:text-gray-400 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all">
                            <X className="w-3.5 h-3.5" /> Close
                        </button>
                        <button
                            onClick={handleLoadMessage}
                            disabled={!selectedMessage}
                            className={`flex items-center gap-1.5 h-9 px-5 text-[13px] font-semibold rounded-lg transition-all duration-150 shadow-sm ${selectedMessage
                                ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-amber-200 dark:shadow-amber-900/30'
                                : 'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <Check className="w-4 h-4" /> Load Message
                        </button>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to   { opacity: 1; transform: scale(1); }
                }
            `}</style>
        </div>
    );
};

export default MessageFormatPopup;
