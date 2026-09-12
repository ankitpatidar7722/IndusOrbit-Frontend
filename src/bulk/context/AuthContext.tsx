import React, { createContext, useContext, useState, useEffect } from 'react';
import {
    companyLogin as companyLoginApi,
    userLogin as userLoginApi,
    indusLogin as indusLoginApi,
    logout as logoutApi,
    checkSession as checkSessionApi,
    CompanyLoginRequest,
    UserLoginRequest,
    IndusLoginRequest
} from '../services/api';

export type LoginType = 'customer' | 'indus';

interface AuthContextType {
    loginStep: 0 | 1 | 2;
    loginType: LoginType;
    companyName: string;
    userName: string;
    fYear: string;
    authorizedModules: string[];
    isAuthenticated: boolean;
    companyLogin: (data: CompanyLoginRequest) => Promise<void>;
    userLogin: (data: UserLoginRequest) => Promise<void>;
    indusLogin: (data: IndusLoginRequest) => Promise<void>;
    logout: () => void;
    checkSessionStatus: () => Promise<boolean>;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEYS = ['authToken', 'companyToken', 'companyName', 'userName', 'fYear', 'loginType', 'authorizedModules', 'enableAutoLogin'];
const clearAuthStorage = () => AUTH_KEYS.forEach(k => localStorage.removeItem(k));

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [loginStep, setLoginStep] = useState<0 | 1 | 2>(0);
    const [loginType, setLoginType] = useState<LoginType>('customer');
    const [companyName, setCompanyName] = useState('');
    const [userName, setUserName] = useState('');
    const [fYear, setFYear] = useState('');
    const [authorizedModules, setAuthorizedModules] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Register 401 handler FIRST — before any API calls — so it catches session-expired responses
        const handleUnauthorized = () => {
            clearAuthStorage();
            setLoginStep(0);
            setLoginType('customer');
            setCompanyName('');
            setUserName('');
            setFYear('');
            setAuthorizedModules([]);
            window.location.href = '/CompanyLogin';
        };
        window.addEventListener('auth:unauthorized', handleUnauthorized);

        const restoreSession = async () => {
            const enableAutoLogin = localStorage.getItem('enableAutoLogin') === 'true';

            if (enableAutoLogin) {
                const authToken = localStorage.getItem('authToken');
                const companyToken = localStorage.getItem('companyToken');
                const storedCompanyName = localStorage.getItem('companyName');
                const storedUserName = localStorage.getItem('userName');
                const storedFYear = localStorage.getItem('fYear');
                const storedLoginType = localStorage.getItem('loginType') as LoginType;

                if (authToken && storedUserName) {
                    // Verify token is still valid on the server before restoring session.
                    // This catches the case where the app pool recycled / server restarted and
                    // wiped the in-memory CompanySessionStore — JWT is still valid but session is gone.
                    const isValid = await checkSessionApi();
                    if (isValid) {
                        setCompanyName(storedCompanyName || '');
                        setUserName(storedUserName);
                        setFYear(storedFYear || '');
                        setLoginType(storedLoginType || 'customer');
                        const storedModules = localStorage.getItem('authorizedModules');
                        setAuthorizedModules(storedModules ? JSON.parse(storedModules) : []);
                        setLoginStep(2);
                    }
                    // If !isValid: the 401 interceptor already fired auth:unauthorized above,
                    // which clears localStorage and redirects to /CompanyLogin.
                } else if (companyToken && storedCompanyName) {
                    // Company login done, user login pending (Step 1)
                    setCompanyName(storedCompanyName);
                    setLoginStep(1);
                } else {
                    setLoginStep(0);
                }
            } else {
                // Auto-login disabled: clear any stale tokens and start fresh
                localStorage.removeItem('authToken');
                localStorage.removeItem('companyToken');
                localStorage.removeItem('companyName');
                localStorage.removeItem('userName');
                localStorage.removeItem('fYear');
                localStorage.removeItem('loginType');
                setLoginStep(0);
            }

            setIsLoading(false);
        };

        restoreSession();

        return () => {
            window.removeEventListener('auth:unauthorized', handleUnauthorized);
        };
    }, []);

    const companyLogin = async (data: CompanyLoginRequest) => {
        const response = await companyLoginApi(data);
        if (response.companyToken) {
            localStorage.setItem('companyToken', response.companyToken);
            localStorage.setItem('companyName', response.companyName);
            setCompanyName(response.companyName);
            setLoginStep(1);
        } else {
            throw new Error(response.message || 'Company login failed. Please check your credentials.');
        }
    };

    const userLogin = async (data: UserLoginRequest) => {
        const response = await userLoginApi(data);
        if (response.token) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userName', response.userName);
            localStorage.setItem('fYear', response.fYear);
            localStorage.setItem('enableAutoLogin', 'true');
            const modules = response.authorizedModules ?? [];
            localStorage.setItem('authorizedModules', JSON.stringify(modules));

            setUserName(response.userName);
            setFYear(response.fYear);
            setAuthorizedModules(modules);
            setLoginStep(2);
        } else {
            throw new Error(response.message || 'User login failed. Please check your credentials.');
        }
    };

    const indusLogin = async (data: IndusLoginRequest) => {
        const response = await indusLoginApi(data);
        if (response.token) {
            localStorage.setItem('authToken', response.token);
            localStorage.setItem('userName', response.webUserName);
            localStorage.setItem('loginType', 'indus');
            localStorage.setItem('companyName', 'Indus');
            localStorage.setItem('enableAutoLogin', 'true'); // Enable session persistence

            setUserName(response.webUserName);
            setCompanyName('Indus');
            setLoginType('indus');
            setLoginStep(2);
        } else {
            throw new Error(response.message || 'Indus login failed. Please check your credentials.');
        }
    };

    const logout = () => {
        logoutApi();
        clearAuthStorage();
        setLoginStep(0);
        setLoginType('customer');
        setCompanyName('');
        setUserName('');
        setFYear('');
        setAuthorizedModules([]);
        window.location.href = '/CompanyLogin';
    };

    const checkSessionStatus = async (): Promise<boolean> => {
        if (loginStep === 2) {
            const isValid = await checkSessionApi();
            if (!isValid) {
                // Interceptor already handles redirect/logout event
                return false;
            }
            return true;
        }
        return false;
    };

    // Periodically check if session is still on server (e.g. every 5 minutes if browser stays open)
    useEffect(() => {
        if (loginStep === 2) {
            const interval = setInterval(checkSessionStatus, 300000); // 5 minutes
            return () => clearInterval(interval);
        }
    }, [loginStep]);

    return (
        <AuthContext.Provider value={{
            loginStep,
            loginType,
            companyName,
            userName,
            fYear,
            authorizedModules,
            isAuthenticated: loginStep === 2,
            companyLogin,
            userLogin,
            indusLogin,
            logout,
            checkSessionStatus,
            isLoading
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
