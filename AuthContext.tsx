import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, getCurrentUser, signIn as authSignIn, signUp as authSignUp, signOut as authSignOut, onAuthStateChange } from './services/auth';

interface AuthContextType {
    user: AuthUser | null;
    isLoading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: string | null }>;
    signUp: (email: string, password: string) => Promise<{ error: string | null }>;
    signOut: () => Promise<void>;
    showLoginModal: boolean;
    setShowLoginModal: (show: boolean) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [showLoginModal, setShowLoginModal] = useState(false);

    // 初始化时获取当前用户
    useEffect(() => {
        const initAuth = async () => {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch (error) {
                console.error('Failed to get current user:', error);
            } finally {
                setIsLoading(false);
            }
        };

        initAuth();

        // 监听认证状态变化
        const unsubscribe = onAuthStateChange((authUser) => {
            setUser(authUser);
        });

        return unsubscribe;
    }, []);

    const signIn = async (email: string, password: string) => {
        const { user: authUser, error } = await authSignIn(email, password);
        if (authUser) {
            setUser(authUser);
            setShowLoginModal(false);
        }
        return { error };
    };

    const signUp = async (email: string, password: string) => {
        const { user: authUser, error } = await authSignUp(email, password);
        if (authUser) {
            setUser(authUser);
            setShowLoginModal(false);
        }
        return { error };
    };

    const signOut = async () => {
        await authSignOut();
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isLoading,
            signIn,
            signUp,
            signOut,
            showLoginModal,
            setShowLoginModal
        }}>
            {children}
        </AuthContext.Provider>
    );
};
