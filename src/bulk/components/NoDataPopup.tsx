import React from 'react';

interface NoDataPopupProps {
    groupName: string;
    onClose: () => void;
}

/**
 * NoDataPopup — shown when "Clear All Data" is triggered but the database
 * has no records for the selected group. Replaces the full confirmation flow.
 */
const NoDataPopup: React.FC<NoDataPopupProps> = ({ groupName, onClose }) => {
    return (
        <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-md w-full border border-gray-100 dark:border-gray-700 overflow-hidden">
                {/* Orange/amber top accent bar — neutral: not success, not error */}
                <div className="bg-gradient-to-r from-amber-400 to-orange-400 h-2 w-full" />

                <div className="p-8 text-center">
                    {/* Info icon — circular amber background */}
                    <div className="mx-auto mb-5 w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center ring-8 ring-amber-50 dark:ring-amber-900/10">
                        <svg
                            className="w-10 h-10 text-amber-600 dark:text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2.5}
                        >
                            {/* Database / no-data icon (database with X) */}
                            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 5.625c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
                        </svg>
                    </div>

                    {/* Title */}
                    <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                        No Data Found
                    </h2>

                    {/* Message */}
                    <p className="text-gray-600 dark:text-gray-300 text-base leading-relaxed mb-6">
                        No data found in the database of{' '}
                        <span className="font-semibold text-gray-800 dark:text-white">
                            {groupName}
                        </span>
                        .
                    </p>

                    {/* OK button — amber */}
                    <button
                        onClick={onClose}
                        className="w-full px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold rounded-xl text-lg transition-all duration-200 active:scale-95 shadow-md shadow-amber-200 dark:shadow-amber-900/30"
                    >
                        OK
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NoDataPopup;
