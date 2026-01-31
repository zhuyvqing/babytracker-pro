import { supabase, isSupabaseConfigured } from '../supabase';

export interface AuthUser {
    id: string;
    email: string;
}

// 本地存储 key
const LOCAL_USER_KEY = 'babytracker_local_user';

// 获取本地模拟用户
function getLocalUser(): AuthUser | null {
    try {
        const stored = localStorage.getItem(LOCAL_USER_KEY);
        return stored ? JSON.parse(stored) : null;
    } catch {
        return null;
    }
}

// 设置本地模拟用户
function setLocalUser(user: AuthUser | null): void {
    try {
        if (user) {
            localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user));
        } else {
            localStorage.removeItem(LOCAL_USER_KEY);
        }
    } catch (e) {
        console.error('Failed to save local user:', e);
    }
}

// 注册
export async function signUp(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
        // 本地模式：模拟注册
        const user: AuthUser = { id: `local_${Date.now()}`, email };
        setLocalUser(user);
        return { user, error: null };
    }

    const { data, error } = await supabase!.auth.signUp({
        email,
        password,
    });

    if (error) {
        return { user: null, error: error.message };
    }

    if (data.user) {
        return {
            user: { id: data.user.id, email: data.user.email || email },
            error: null,
        };
    }

    return { user: null, error: '注册失败，请重试' };
}

// 登录
export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
    if (!isSupabaseConfigured()) {
        // 本地模式：模拟登录
        const user: AuthUser = { id: `local_${Date.now()}`, email };
        setLocalUser(user);
        return { user, error: null };
    }

    const { data, error } = await supabase!.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        return { user: null, error: error.message };
    }

    if (data.user) {
        return {
            user: { id: data.user.id, email: data.user.email || email },
            error: null,
        };
    }

    return { user: null, error: '登录失败，请重试' };
}

// 退出登录
export async function signOut(): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured()) {
        setLocalUser(null);
        return { error: null };
    }

    const { error } = await supabase!.auth.signOut();
    return { error: error?.message || null };
}

// 获取当前用户
export async function getCurrentUser(): Promise<AuthUser | null> {
    if (!isSupabaseConfigured()) {
        return getLocalUser();
    }

    const { data: { user } } = await supabase!.auth.getUser();

    if (user) {
        return { id: user.id, email: user.email || '' };
    }

    return null;
}

// 监听认证状态变化
export function onAuthStateChange(callback: (user: AuthUser | null) => void): () => void {
    if (!isSupabaseConfigured()) {
        // 本地模式不需要监听
        return () => { };
    }

    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
        if (session?.user) {
            callback({ id: session.user.id, email: session.user.email || '' });
        } else {
            callback(null);
        }
    });

    return () => subscription.unsubscribe();
}
