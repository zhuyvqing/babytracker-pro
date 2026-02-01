import React, { useState, useMemo, useEffect, useCallback, memo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../App';
import { useAuth } from '../AuthContext';
import { useBaby } from '../BabyContext';
import { FeedRecord } from '../types';
import { getReminders, createReminder, deleteReminder, ReminderItem as DbReminderItem } from '../services/database';

// --- Reuse Modal Component ---
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: React.ReactNode;
  onSave: () => void;
}> = ({ isOpen, onClose, title, icon, children, onSave }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      <div className="relative w-full max-w-sm bg-background-light dark:bg-background-dark rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-full bg-primary/20 flex items-center justify-center text-primary">
              <span className="material-symbols-outlined">{icon}</span>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="mb-8">
          {children}
        </div>

        <button
          onClick={onSave}
          className="w-full h-12 rounded-2xl bg-primary text-primary-content font-bold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-glow"
        >
          保存提醒
        </button>
      </div>
    </div>
  );
};

interface ReminderItem {
  id: string;
  title: string;
  timeLabel: string; // e.g., "下午 2:00" or "上午 10:30"
  status: 'pending' | 'completed';
  description: string;
  type: 'feed' | 'diaper';
}

const RemindersView: React.FC = memo(() => {
  const navigate = useNavigate();
  const { records } = useRecords();
  const { user, setShowLoginModal } = useAuth();
  const { babyName } = useBaby();

  // --- State ---
  const [activeModal, setActiveModal] = useState<'feed' | 'diaper' | null>(null);

  // Reminder settings state - allow string for empty input handling
  const [delayHours, setDelayHours] = useState<number | string>(2);
  const [delayMinutes, setDelayMinutes] = useState<number | string>(0);

  // Local list of reminders
  const [reminderList, setReminderList] = useState<ReminderItem[]>([]);
  const [isLoadingReminders, setIsLoadingReminders] = useState(true);

  // Load reminders from database on mount
  useEffect(() => {
    const loadReminders = async () => {
      try {
        const data = await getReminders();
        if (data.length > 0) {
          setReminderList(data.map(r => ({
            id: r.id,
            title: r.title,
            timeLabel: r.timeLabel,
            status: r.status,
            description: r.description,
            type: r.type,
          })));
        }
        // 数据库为空时保持空数组，不初始化静态数据
      } catch (error) {
        console.error('Failed to load reminders:', error);
      } finally {
        setIsLoadingReminders(false);
      }
    };
    loadReminders();
  }, []);

  // --- Logic to get last records ---
  const lastFeedRecord = useMemo(() => {
    return records
      .filter(r => r.type === 'breast' || r.type === 'bottle')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
  }, [records]);

  const lastDiaperRecord = useMemo(() => {
    return records
      .filter(r => r.type === 'diaper')
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
  }, [records]);

  // Base time for calculation
  const getBaseTime = () => {
    if (activeModal === 'feed' && lastFeedRecord) return new Date(lastFeedRecord.startTime);
    if (activeModal === 'diaper' && lastDiaperRecord) return new Date(lastDiaperRecord.startTime);
    return new Date(); // Default to now if no record
  };

  // Helper to safely get numeric values
  const getSafeDelay = () => {
    const h = typeof delayHours === 'number' ? delayHours : (parseInt(delayHours) || 0);
    const m = typeof delayMinutes === 'number' ? delayMinutes : (parseInt(delayMinutes) || 0);
    return { h, m };
  };

  const calculateTargetTime = () => {
    const base = getBaseTime();
    const { h, m } = getSafeDelay();
    const target = new Date(base.getTime() + (h * 60 * 60 * 1000) + (m * 60 * 1000));
    return target;
  };

  const handleOpenModal = (type: 'feed' | 'diaper') => {
    setActiveModal(type);
    setDelayHours(type === 'feed' ? 3 : 2); // Default defaults
    setDelayMinutes(0);
  };

  const handleSaveReminder = async () => {
    const targetDate = calculateTargetTime();
    const { h, m } = getSafeDelay();

    // Format time for display (e.g., "下午 4:30")
    const timeLabel = targetDate.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: true });

    const reminderData = {
      title: activeModal === 'feed' ? '下次喂养' : '下次换尿布',
      timeLabel: timeLabel,
      status: 'pending' as const,
      description: `待提醒 - 基于上次${activeModal === 'feed' ? '喂养' : '换尿布'} + ${h}小时${m > 0 ? m + '分' : ''}`,
      type: (activeModal === 'feed' ? 'feed' : 'diaper') as 'feed' | 'diaper',
      scheduledTime: targetDate.toISOString(),
    };

    // Optimistically add to UI
    const tempReminder: ReminderItem = { id: Date.now().toString(), ...reminderData };
    setReminderList(prev => [tempReminder, ...prev]);
    setActiveModal(null);

    // Persist to database
    const saved = await createReminder(reminderData);
    if (saved) {
      setReminderList(prev => prev.map(r => r.id === tempReminder.id ? { ...r, id: saved.id } : r));
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center px-4 py-4 justify-between bg-background-light dark:bg-background-dark sticky top-0 z-50">
        <button
          onClick={() => startTransition(() => navigate('/'))}
          className="text-slate-900 dark:text-white flex size-10 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[24px]">arrow_back</span>
        </button>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">
          {user ? '提醒' : '未登录'}
        </h2>
      </div>

      {/* 未登录提示 */}
      {!user && (
        <div
          className="mx-4 mb-4 p-4 bg-primary/10 rounded-xl flex items-center gap-3 cursor-pointer hover:bg-primary/20 transition-colors"
          onClick={() => setShowLoginModal(true)}
        >
          <span className="material-symbols-outlined text-primary">login</span>
          <div>
            <p className="font-bold text-slate-900 dark:text-white">请登录后使用</p>
            <p className="text-sm text-slate-500 dark:text-gray-400">点击此处登录账号</p>
          </div>
        </div>
      )}

      <div className="flex-1 px-4 pb-8 space-y-6">

        {/* Profile Card */}
        <div className="flex flex-col gap-2">
          <h3 className="text-slate-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider px-2">宝宝档案</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm">
            <div
              onClick={() => user ? startTransition(() => navigate('/growth')) : setShowLoginModal(true)}
              className="flex items-center gap-4 p-4 justify-between cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div
                  className="bg-center bg-no-repeat aspect-square bg-cover rounded-full h-12 w-12 border-2 border-primary flex items-center justify-center overflow-hidden bg-slate-200 dark:bg-slate-700"
                  style={user ? { backgroundImage: 'url("https://pub-141831e61e69445289222976a15b6fb3.r2.dev/Image_to_url_V2/2961acfdb72778ce59c1bdb7cdd58a2f-imagetourl.cloud-1769854736932-p60gi5.jpeg")' } : {}}
                >
                  {!user && <span className="material-symbols-outlined text-slate-400">person</span>}
                </div>
                <div className="flex flex-col">
                  <p className="text-slate-900 dark:text-white text-base font-bold leading-tight">
                    {user ? (babyName || '请填写Baby名称') : '未填写'}
                  </p>
                  <p className="text-slate-500 dark:text-gray-400 text-xs">
                    {user ? '管理档案' : '请登录后填写'}
                  </p>
                </div>
              </div>
              <div className="shrink-0 text-slate-400 dark:text-gray-500">
                <span className="material-symbols-outlined">chevron_right</span>
              </div>
            </div>
          </div>
        </div>

        {/* Reminder Settings */}
        <div className="flex flex-col gap-2">
          <h3 className="text-slate-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider px-2">提醒设置</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-white/10">
            {/* Feed Setting */}
            <div className="flex items-center gap-4 p-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 shrink-0 size-10">
                  <span className="material-symbols-outlined">pediatrics</span>
                </div>
                <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1">下次喂养</p>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => user ? handleOpenModal('feed') : setShowLoginModal(true)}
                  className="flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-full p-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            </div>
            {/* Diaper Setting */}
            <div className="flex items-center gap-4 p-4 justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 shrink-0 size-10">
                  <span className="material-symbols-outlined">soap</span>
                </div>
                <p className="text-slate-900 dark:text-white text-base font-medium leading-normal flex-1">更换尿布</p>
              </div>
              <div className="shrink-0">
                <button
                  onClick={() => user ? handleOpenModal('diaper') : setShowLoginModal(true)}
                  className="flex items-center justify-center bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20 text-slate-900 dark:text-white rounded-full p-1.5 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">add</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* All Records */}
        <div className="flex flex-col gap-2">
          <h3 className="text-slate-500 dark:text-gray-400 text-sm font-bold uppercase tracking-wider px-2">所有记录</h3>
          <div className="bg-surface-light dark:bg-surface-dark rounded-xl overflow-hidden shadow-sm divide-y divide-gray-100 dark:divide-white/10">


            {reminderList.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-gray-500">
                <span className="material-symbols-outlined text-3xl mb-2">notifications_off</span>
                <p className="font-medium">暂无数据信息</p>
              </div>
            ) : (
              reminderList.map((item) => (
                <div
                  key={item.id}
                  className={`flex items-center gap-4 p-4 ${item.status === 'pending'
                    ? 'bg-primary/5 dark:bg-primary/10 border-l-4 border-primary'
                    : ''
                    }`}
                >
                  <div className="flex flex-col flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        {item.status === 'pending' && <span className="material-symbols-outlined text-primary text-sm">schedule</span>}
                        <span className={`text-base ${item.status === 'pending' ? 'font-bold text-slate-900 dark:text-white' : 'font-medium text-slate-900 dark:text-white'}`}>
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs ${item.status === 'pending' ? 'text-primary font-bold' : 'text-slate-400 dark:text-gray-500'}`}>
                          {item.timeLabel}
                        </span>
                        <button
                          onClick={async () => {
                            setReminderList(prev => prev.filter(r => r.id !== item.id));
                            await deleteReminder(item.id);
                          }}
                          className="p-1.5 rounded-full text-red-400 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                    <p className="text-slate-500 dark:text-gray-400 text-sm">{item.description}</p>
                  </div>
                </div>
              ))
            )}

          </div>
        </div>

        <div className="pt-6 pb-2 text-center">
          <p className="text-xs text-slate-400 dark:text-gray-600">Version 1.0.2</p>
        </div>

        {/* --- Reminder Modal --- */}
        <Modal
          isOpen={!!activeModal}
          onClose={() => setActiveModal(null)}
          title={activeModal === 'feed' ? '设置喂养提醒' : '设置尿布提醒'}
          icon={activeModal === 'feed' ? 'pediatrics' : 'soap'}
          onSave={handleSaveReminder}
        >
          <div className="flex flex-col gap-5">
            {/* Last Record Info */}
            <div className="bg-slate-100 dark:bg-white/5 p-4 rounded-xl flex justify-between items-center">
              <span className="text-sm text-slate-500 dark:text-gray-400">最近一次{activeModal === 'feed' ? '喂养' : '换尿布'}</span>
              <span className="text-base font-bold text-slate-900 dark:text-white">
                {getBaseTime().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Delay Input */}
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-3 block">提醒间隔</label>

              <div className="flex flex-col gap-4">
                {/* Hours Row */}
                <div className="flex flex-col gap-2">
                  <span className="text-slate-900 dark:text-white font-medium pl-1">小时</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const val = typeof delayHours === 'number' ? delayHours : (parseInt(delayHours) || 0);
                        setDelayHours(Math.max(0, val - 1));
                      }}
                      className="h-14 w-14 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
                    >-</button>
                    <div className="flex-1 h-14 bg-surface-light dark:bg-black/20 rounded-xl border-2 border-primary/20 flex items-center justify-center">
                      <input
                        type="number"
                        value={delayHours}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') setDelayHours('');
                          else {
                            const num = parseInt(val);
                            if (!isNaN(num)) setDelayHours(Math.max(0, num));
                          }
                        }}
                        className="w-full h-full bg-transparent border-none text-center font-bold text-3xl p-0 focus:ring-0 text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const val = typeof delayHours === 'number' ? delayHours : (parseInt(delayHours) || 0);
                        setDelayHours(val + 1);
                      }}
                      className="h-14 w-14 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
                    >+</button>
                  </div>
                </div>

                {/* Minutes Row */}
                <div className="flex flex-col gap-2">
                  <span className="text-slate-900 dark:text-white font-medium pl-1">分钟</span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const val = typeof delayMinutes === 'number' ? delayMinutes : (parseInt(delayMinutes) || 0);
                        setDelayMinutes(Math.max(0, val - 10));
                      }}
                      className="h-14 w-14 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
                    >-</button>
                    <div className="flex-1 h-14 bg-surface-light dark:bg-black/20 rounded-xl border-2 border-primary/20 flex items-center justify-center">
                      <input
                        type="number"
                        value={delayMinutes}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === '') setDelayMinutes('');
                          else {
                            const num = parseInt(val);
                            if (!isNaN(num)) setDelayMinutes(Math.max(0, num));
                          }
                        }}
                        className="w-full h-full bg-transparent border-none text-center font-bold text-3xl p-0 focus:ring-0 text-slate-900 dark:text-white"
                      />
                    </div>
                    <button
                      onClick={() => {
                        const val = typeof delayMinutes === 'number' ? delayMinutes : (parseInt(delayMinutes) || 0);
                        setDelayMinutes(val + 10);
                      }}
                      className="h-14 w-14 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all"
                    >+</button>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="flex items-center justify-center gap-2 text-primary font-bold">
              <span className="material-symbols-outlined">alarm</span>
              <span>预计提醒: {calculateTargetTime().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
});

export default RemindersView;