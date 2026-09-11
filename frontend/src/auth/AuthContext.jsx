import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
    api,
    clearStoredToken,
    getStoredToken,
    setStoredToken,
    setUnauthorizedHandler
} from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null);
    const [isRestoringSession, setIsRestoringSession] = useState(true);

    const signOut = useCallback(() => {
        clearStoredToken();
        setCurrentUser(null);
    }, []);

    useEffect(() => {
        setUnauthorizedHandler(() => {
            clearStoredToken();
            setCurrentUser(null);
        });

        return () => setUnauthorizedHandler(null);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function restoreSession() {
            if (!getStoredToken()) {
                setIsRestoringSession(false);
                return;
            }

            try {
                const payload = await api.currentUser();
                if (!cancelled) {
                    setCurrentUser(payload.user);
                }
            } catch (error) {
                if (!cancelled) {
                    clearStoredToken();
                    setCurrentUser(null);
                }
            } finally {
                if (!cancelled) {
                    setIsRestoringSession(false);
                }
            }
        }

        restoreSession();

        return () => {
            cancelled = true;
        };
    }, []);

    const signIn = useCallback(async (email, password) => {
        const payload = await api.login(email, password);
        setStoredToken(payload.token);
        setCurrentUser(payload.user);
        return payload.user;
    }, []);

    const value = useMemo(
        () => ({
            currentUser,
            isRestoringSession,
            isAdmin: currentUser?.role === 'admin',
            signIn,
            signOut
        }),
        [currentUser, isRestoringSession, signIn, signOut]
    );

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
    const context = useContext(AuthContext);

    if (!context) {
        throw new Error('useAuth must be used inside an AuthProvider');
    }

    return context;
}
