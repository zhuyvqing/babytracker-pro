import React, { useState } from 'react';
import { useAuth } from '../AuthContext';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
}

const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
    const { signIn, signUp } = useAuth();
    const [isRegister, setIsRegister] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async () => {
        setError('');

        // 验证
        if (!email.trim()) {
            setError('请输入邮箱');
            return;
        }
        if (!password) {
            setError('请输入密码');
            return;
        }
        if (password.length < 6) {
            setError('密码至少需要6个字符');
            return;
        }
        if (isRegister && password !== confirmPassword) {
            setError('两次输入的密码不一致');
            return;
        }

        setIsLoading(true);
        try {
            const result = isRegister
                ? await signUp(email.trim(), password)
                : await signIn(email.trim(), password);

            if (result.error) {
                setError(result.error);
            }
        } finally {
            setIsLoading(false);
        }
    };

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        resetForm();
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center sm:p-4">
            {/* 背景遮罩 */}
            <div
                className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
                onClick={onClose}
            />

            {/* 弹窗内容 */}
            <div className="relative w-full max-w-sm bg-background-light dark:bg-background-dark rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-200">
                {/* 头部 */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                            <span className="material-symbols-outlined">person</span>
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                            {isRegister ? '注册账号' : '登录账号'}
                        </h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500"
                    >
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* 表单 */}
                <div className="flex flex-col gap-4 mb-6">
                    {/* 邮箱 */}
                    <div>
                        <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
                            邮箱
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="请输入邮箱"
                            className="w-full h-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary"
                        />
                    </div>

                    {/* 密码 */}
                    <div>
                        <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
                            密码
                        </label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="请输入密码（至少6位）"
                            className="w-full h-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary"
                        />
                    </div>

                    {/* 确认密码（注册时显示） */}
                    {isRegister && (
                        <div className="animate-in slide-in-from-top-2 fade-in duration-200">
                            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
                                确认密码
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="请再次输入密码"
                                className="w-full h-12 bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary"
                            />
                        </div>
                    )}

                    {/* 错误提示 */}
                    {error && (
                        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 dark:bg-red-900/20 p-3 rounded-xl">
                            <span className="material-symbols-outlined text-lg">error</span>
                            {error}
                        </div>
                    )}
                </div>

                {/* 提交按钮 */}
                <button
                    onClick={handleSubmit}
                    disabled={isLoading}
                    className="w-full h-12 rounded-2xl bg-primary text-primary-content font-bold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-glow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isLoading ? (
                        <>
                            <span className="material-symbols-outlined animate-spin">progress_activity</span>
                            处理中...
                        </>
                    ) : (
                        isRegister ? '注册' : '登录'
                    )}
                </button>

                {/* 切换登录/注册 */}
                <div className="mt-4 text-center">
                    <button
                        onClick={toggleMode}
                        className="text-sm text-primary hover:underline"
                    >
                        {isRegister ? '已有账号？点击登录' : '没有账号？点击注册'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LoginModal;
