import React, { useEffect, useState } from 'react';

interface LoadingOverlayProps {
    message?: string;
    progress?: number; // 0 to 100
    isVisible?: boolean;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
    message = 'Loading...',
    progress,
    isVisible = true
}) => {
    const [simulatedProgress, setSimulatedProgress] = useState(0);

    useEffect(() => {
        if (progress !== undefined) return; // Use real progress if provided

        // Simulate progress for indeterminate states
        const interval = setInterval(() => {
            setSimulatedProgress(prev => {
                if (prev >= 90) return prev; // Stall at 90%
                return prev + Math.random() * 10;
            });
        }, 500);

        return () => clearInterval(interval);
    }, [progress]);

    const displayProgress = progress !== undefined ? progress : simulatedProgress;

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900/40 via-slate-900/50 to-slate-900/40 backdrop-blur-md animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 w-[340px] flex flex-col items-center animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-gray-700 relative overflow-hidden">

                {/* Animated Background Gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-blue-50/50 via-transparent to-purple-50/50 dark:from-blue-900/10 dark:via-transparent dark:to-purple-900/10 animate-pulse"></div>

                {/* Content */}
                <div className="relative z-10 flex flex-col items-center w-full">
                    {/* Logo */}
                    <div className="mb-4 relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-full blur-lg opacity-30 animate-pulse"></div>
                        <img
                            src="/PrintudeAI.png"
                            alt="PrintudeAI"
                            className="w-16 h-16 object-contain relative z-10 drop-shadow-xl animate-in zoom-in duration-500"
                        />
                    </div>

                    {/* Three Dots Animation */}
                    <div className="flex gap-2 mb-4">
                        <div className="w-2.5 h-2.5 bg-gradient-to-br from-[#0f294d] to-[#1a3a6b] rounded-full animate-bounce shadow-md" style={{ animationDelay: '-0.3s' }}></div>
                        <div className="w-2.5 h-2.5 bg-gradient-to-br from-[#0f294d] to-[#1a3a6b] rounded-full animate-bounce shadow-md" style={{ animationDelay: '-0.15s' }}></div>
                        <div className="w-2.5 h-2.5 bg-gradient-to-br from-[#0f294d] to-[#1a3a6b] rounded-full animate-bounce shadow-md"></div>
                    </div>

                    {/* Loading Message */}
                    <h3 className="text-slate-700 dark:text-gray-200 font-semibold text-base mb-4 tracking-wide">
                        {message}
                    </h3>

                    {/* Progress Bar Container */}
                    <div className="w-full mb-2">
                        <div className="w-full h-2.5 bg-slate-100 dark:bg-gray-700 rounded-full overflow-hidden shadow-inner">
                            <div
                                className="h-full bg-gradient-to-r from-[#0f294d] via-[#1a3a6b] to-[#0f294d] rounded-full transition-all duration-300 ease-out relative"
                                style={{ width: `${Math.round(displayProgress)}%` }}
                            >
                                {/* Shimmer Effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
                            </div>
                        </div>
                    </div>

                    {/* Percentage */}
                    <span className="text-sm font-bold text-[#0f294d] dark:text-blue-400 tracking-wider mb-2">
                        {Math.round(displayProgress)}%
                    </span>

                    {/* Loading Spinner (optional decorative element) */}
                    <div>
                        <svg className="animate-spin h-4 w-4 text-[#0f294d] dark:text-blue-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Add shimmer animation to your global CSS or tailwind config
// @keyframes shimmer {
//   0% { transform: translateX(-100%); }
//   100% { transform: translateX(100%); }
// }
