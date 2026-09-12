import React from 'react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
export type MessageType = 'success' | 'error' | 'warning' | 'info' | 'confirmation';

export interface MessageModalProps {
    type: MessageType;
    title: string;
    message: string | React.ReactNode;
    onClose: () => void;
    /** Confirmation only: called when user clicks Yes */
    onConfirm?: () => void;
    /** Optional: override the OK button label */
    okLabel?: string;
    /** Optional: override the Confirm button label for confirmation dialogs */
    confirmLabel?: string;
    /** Optional: override the Cancel button label for confirmation dialogs */
    cancelLabel?: string;
}

// ─────────────────────────────────────────────
// Icon helpers per type
// ─────────────────────────────────────────────
const icons: Record<MessageType, React.ReactNode> = {
    success: (
        <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
    ),
    error: (
        <svg className="w-10 h-10 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
        </svg>
    ),
    warning: (
        <svg className="w-10 h-10 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
    ),
    info: (
        <svg className="w-10 h-10 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
        </svg>
    ),
    confirmation: (
        <svg className="w-10 h-10 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
    ),
};

// ─────────────────────────────────────────────
// Colour themes per type
// ─────────────────────────────────────────────
const themes: Record<MessageType, {
    bar: string;
    iconBg: string;
    iconRing: string;
    btn: string;
    confirmBtn: string;
}> = {
    success: {
        bar: 'bg-gradient-to-r from-green-500 to-emerald-500',
        iconBg: 'bg-green-100 dark:bg-green-900/30',
        iconRing: 'ring-green-50 dark:ring-green-900/10',
        btn: 'bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 shadow-green-200 dark:shadow-green-900/30',
        confirmBtn: '',
    },
    error: {
        bar: 'bg-gradient-to-r from-red-500 to-rose-500',
        iconBg: 'bg-red-100 dark:bg-red-900/30',
        iconRing: 'ring-red-50 dark:ring-red-900/10',
        btn: 'bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 shadow-red-200 dark:shadow-red-900/30',
        confirmBtn: '',
    },
    warning: {
        bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
        iconBg: 'bg-amber-100 dark:bg-amber-900/30',
        iconRing: 'ring-amber-50 dark:ring-amber-900/10',
        btn: 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-amber-200 dark:shadow-amber-900/30',
        confirmBtn: '',
    },
    info: {
        bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
        iconBg: 'bg-blue-100 dark:bg-blue-900/30',
        iconRing: 'ring-blue-50 dark:ring-blue-900/10',
        btn: 'bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-blue-200 dark:shadow-blue-900/30',
        confirmBtn: '',
    },
    confirmation: {
        bar: 'bg-gradient-to-r from-indigo-500 to-violet-500',
        iconBg: 'bg-indigo-100 dark:bg-indigo-900/30',
        iconRing: 'ring-indigo-50 dark:ring-indigo-900/10',
        btn: 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-indigo-200 dark:shadow-indigo-900/30',
        confirmBtn: 'bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 shadow-indigo-200 dark:shadow-indigo-900/30',
    },
};

// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────
const MessageModal: React.FC<MessageModalProps> = ({
    type,
    title,
    message,
    onClose,
    onConfirm,
    okLabel = 'OK',
    confirmLabel = 'Yes',
    cancelLabel = 'No',
}) => {
    const theme = themes[type];
    const icon = icons[type];
    const isConfirmation = type === 'confirmation' || !!onConfirm;

    return (
        <div
            className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4"
            style={{ animation: 'fadeIn 0.15s ease-out' }}
        >
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Colour accent bar */}
                <div className={`${theme.bar} h-2 w-full`} />

                <div className="p-8 text-center">
                    {/* Icon */}
                    <div className={`mx-auto mb-5 w-20 h-20 ${theme.iconBg} rounded-full flex items-center justify-center ring-8 ${theme.iconRing}`}>
                        {icon}
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                        {title}
                    </h2>

                    {/* Message body */}
                    <div className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-6 text-left">
                        {typeof message === 'string'
                            ? message.split('\n').map((line, i) => (
                                <p key={i} className={line.trim() === '' ? 'mt-2' : 'mt-1'}>
                                    {line}
                                </p>
                            ))
                            : message
                        }
                    </div>

                    {/* Buttons */}
                    {isConfirmation ? (
                        <div className="flex gap-3">
                            <button
                                onClick={onConfirm}
                                className={`flex-1 px-6 py-3 ${theme.confirmBtn || theme.btn} text-white font-semibold rounded-xl text-base transition-all duration-200 active:scale-95 shadow-md`}
                            >
                                {confirmLabel}
                            </button>
                            <button
                                onClick={onClose}
                                className="flex-1 px-6 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-base transition-all duration-200 active:scale-95"
                            >
                                {cancelLabel}
                            </button>
                        </div>
                    ) : (
                        <button
                            onClick={onClose}
                            className={`w-full px-6 py-3 ${theme.btn} text-white font-semibold rounded-xl text-base transition-all duration-200 active:scale-95 shadow-md`}
                        >
                            {okLabel}
                        </button>
                    )}
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

export default MessageModal;

// ─────────────────────────────────────────────
// Hook: useMessageModal
// Provides ShowMessage(type, title, message) pattern.
// ─────────────────────────────────────────────
interface ModalState {
    open: boolean;
    type: MessageType;
    title: string;
    message: string | React.ReactNode;
    onConfirm?: () => void;
    okLabel?: string;
    confirmLabel?: string;
    cancelLabel?: string;
}

export function useMessageModal() {
    const [modal, setModal] = React.useState<ModalState>({
        open: false,
        type: 'info',
        title: '',
        message: '',
    });

    const closeModal = React.useCallback(() => {
        setModal(prev => ({ ...prev, open: false }));
    }, []);

    const showMessage = React.useCallback(
        (
            type: MessageType,
            title: string,
            message: string | React.ReactNode,
            options?: {
                onConfirm?: () => void;
                okLabel?: string;
                confirmLabel?: string;
                cancelLabel?: string;
            }
        ) => {
            const wrappedOnConfirm = options?.onConfirm ? () => {
                options.onConfirm?.();
                closeModal();
            } : undefined;

            setModal({ 
                open: true, 
                type, 
                title, 
                message, 
                ...options,
                onConfirm: wrappedOnConfirm 
            });
        },
        [closeModal]
    );

    const ModalRenderer = modal.open ? (
        <MessageModal
            type={modal.type}
            title={modal.title}
            message={modal.message}
            onClose={closeModal}
            onConfirm={modal.onConfirm}
            okLabel={modal.okLabel}
            confirmLabel={modal.confirmLabel}
            cancelLabel={modal.cancelLabel}
        />
    ) : null;

    return { showMessage, closeModal, ModalRenderer };
}
