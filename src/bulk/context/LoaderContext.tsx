import React, { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import { setLoaderHooks } from '../services/api';
import { LoadingOverlay } from '../components/LoadingOverlay';

interface LoaderContextType {
    isLoading: boolean;
    loadingText: string;
    showLoader: (text?: string) => void;
    hideLoader: () => void;
}

const LoaderContext = createContext<LoaderContextType | undefined>(undefined);

export const useLoader = () => {
    const context = useContext(LoaderContext);
    if (!context) throw new Error('useLoader must be used within LoaderProvider');
    return context;
};

export const LoaderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isLoading, setIsLoading] = useState(false);
    const [loadingText, setLoadingText] = useState('Processing...');
    const activeRequests = useRef(0);

    const showLoader = useCallback((text?: string) => {
        activeRequests.current++;
        if (text) setLoadingText(text);
        setIsLoading(true);
    }, []);

    const hideLoader = useCallback(() => {
        activeRequests.current = Math.max(0, activeRequests.current - 1);
        if (activeRequests.current === 0) {
            setIsLoading(false);
            setLoadingText('Processing...');
        }
    }, []);

    // Connect to axios interceptors
    useEffect(() => {
        setLoaderHooks(showLoader, hideLoader);
    }, [showLoader, hideLoader]);

    return (
        <LoaderContext.Provider value={{ isLoading, loadingText, showLoader, hideLoader }}>
            {children}
            <LoadingOverlay message={loadingText} isVisible={isLoading} />
        </LoaderContext.Provider>
    );
};
