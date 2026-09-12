import React from 'react';

interface ClearSuccessPopupProps {
    rowCount: number;
    groupName: string;
    onClose: () => void;
}

/**
 * ClearSuccessPopup — shown after "Clear All Data" completes successfully.
 * Red-themed to distinguish from the green Import Successful popup.
 * Same structural design: icon · title · count · subtitle · OK button.
 */
const ClearSuccessPopup: React.FC<ClearSuccessPopupProps> = ({ rowCount, groupName, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Red top accent bar */}
                <div className="bg-gradient-to-r from-red-500 to-rose-500 h-2 w-full" />

                <div className="p-8 text-center">
                    {/* Red circular icon with trash / delete symbol */}
                    <div className="mx-auto mb-5 w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center ring-8 ring-red-50 dark:ring-red-900/10">
                        <svg
                            className="w-10 h-10 text-red-600 dark:text-red-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            {/* Checkmark — success indicator even for delete */}
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                    </div>

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                        Clear All Data Successful!
                    </h2>

                    {/* Subtitle */}
                    <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-1">
                        Successfully deleted
                    </p>

                    {/* Big row count */}
                    <p className="text-4xl font-extrabold text-red-600 dark:text-red-400 mb-1">
                        {rowCount}
                    </p>

                    {/* Row label + group name */}
                    <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-6">
                        {rowCount === 1 ? 'row' : 'rows'} from{' '}
                        <span className="font-semibold text-gray-800 dark:text-white">
                            {groupName}
                        </span>
                    </p>

                    {/* OK button — red */}
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white font-semibold rounded-xl text-lg transition-all duration-200 active:scale-95 shadow-md shadow-red-200 dark:shadow-red-900/30"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ClearSuccessPopup;
