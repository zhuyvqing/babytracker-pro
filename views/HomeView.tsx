import React, { useState, useEffect, useMemo, memo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRecords } from '../App';
import { useAuth } from '../AuthContext';
import { useBaby } from '../BabyContext';
import { useTimer } from '../TimerContext';
import { FeedRecord, RecordType } from '../types';

// --- Modal Component ---
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
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      ></div>

      {/* Content */}
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
          保存记录
        </button>
      </div>
    </div>
  );
};

const HomeView: React.FC = () => {
  const navigate = useNavigate();
  const { addRecord, records } = useRecords();
  const { user, setShowLoginModal } = useAuth();
  const { babyName } = useBaby();
  const {
    isRunning: timerRunning,
    elapsedSeconds: seconds,
    selectedSide,
    startTimer,
    pauseTimer,
    resetTimer,
    setSelectedSide,
    toggleSide,
  } = useTimer();

  // 检查登录状态的辅助函数
  const requireLogin = (callback: () => void) => {
    if (!user) {
      setShowLoginModal(true);
      return;
    }
    callback();
  };

  const [isSaved, setIsSaved] = useState(false);
  const [now, setNow] = useState(new Date());

  // Modal State
  const [activeModal, setActiveModal] = useState<RecordType | null>(null);

  // Form States
  const [bottleAmount, setBottleAmount] = useState<number>(120);
  const [bottleTime, setBottleTime] = useState<string>(''); // For bottle time input
  const [isSnack, setIsSnack] = useState<boolean>(false); // For bottle snack toggle

  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'mixed'>('wet');
  const [diaperAmount, setDiaperAmount] = useState<'small' | 'medium' | 'large'>('medium');

  const [sleepStart, setSleepStart] = useState<string>('');
  const [sleepEnd, setSleepEnd] = useState<string>('');

  // Pump State
  const [pumpAmount, setPumpAmount] = useState<number>(120);
  const [pumpTime, setPumpTime] = useState<string>('');

  // Update "now" every 10 seconds to reduce re-renders (was every 1 second)
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(interval);
  }, []);

  // Initialize times when opening modals
  useEffect(() => {
    const currentTime = new Date();
    const timeString = currentTime.toTimeString().slice(0, 5); // "HH:MM"

    if (activeModal === 'sleep') {
      const oneHourAgo = new Date(currentTime.getTime() - 60 * 60 * 1000);
      setSleepEnd(timeString);
      setSleepStart(oneHourAgo.toTimeString().slice(0, 5));
    } else if (activeModal === 'bottle') {
      setBottleTime(timeString);
      setIsSnack(false); // Reset snack state
    } else if (activeModal === 'pump') {
      setPumpTime(timeString);
    }
  }, [activeModal]);

  // Timer logic is now handled by TimerContext

  // Calculate Last Feed (Breast or Bottle)
  const lastFeedRecord = useMemo(() => {
    return records.find(r => r.type === 'breast' || r.type === 'bottle');
  }, [records]);

  // Calculate Last Side (Breast only)
  const lastBreastRecord = useMemo(() => {
    return records.find(r => r.type === 'breast');
  }, [records]);

  const getLastFeedDisplay = () => {
    if (!lastFeedRecord) return { val: '--', suffix: '' };

    const diffMs = now.getTime() - new Date(lastFeedRecord.startTime).getTime();
    const totalMins = Math.floor(diffMs / 60000);

    if (totalMins < 1) return { val: '刚刚', suffix: '' };

    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (hours === 0) return { val: `${mins}分钟`, suffix: '前' };
    return { val: `${hours}小时 ${mins}分`, suffix: '前' };
  };

  const getLastSideDisplay = () => {
    if (!lastBreastRecord) return { side: '--', duration: '' };
    const side = lastBreastRecord.side === 'left' ? '左侧' : '右侧';

    let duration = '';
    if (lastBreastRecord.durationSeconds !== undefined) {
      const m = Math.floor(lastBreastRecord.durationSeconds / 60);
      const s = lastBreastRecord.durationSeconds % 60;
      if (m > 0) duration = `时长 ${m}分${s}秒`;
      else duration = `时长 ${s}秒`;
    } else if (lastBreastRecord.durationMinutes) {
      duration = `时长 ${lastBreastRecord.durationMinutes}分钟`;
    }

    return { side, duration };
  };

  const lastFeedData = getLastFeedDisplay();
  const lastSideData = getLastSideDisplay();

  const formatTime = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = () => {
    pauseTimer();
  };

  const handleSaveTimer = () => {
    if (seconds === 0) return;

    // Calculate start time based on current time minus elapsed seconds
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - seconds * 1000);

    const newRecord: FeedRecord = {
      id: Date.now().toString(),
      type: 'breast',
      side: selectedSide,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      durationMinutes: Math.max(1, Math.ceil(seconds / 60)),
      durationSeconds: seconds,
      date: '今天'
    };

    addRecord(newRecord);
    resetTimer();
    toggleSide(); // Automatically switch to opposite side for next feeding
    showSaveFeedback();
  };

  const showSaveFeedback = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  // --- Quick Add Handlers ---

  const handleSaveBottle = () => {
    // Construct Start Time from current date + selected time
    const today = new Date();
    const [hours, minutes] = bottleTime.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);

    addRecord({
      id: Date.now().toString(),
      type: 'bottle',
      startTime: today.toISOString(),
      amountMl: bottleAmount,
      isSnack: isSnack,
      date: '今天'
    });
    setActiveModal(null);
    showSaveFeedback();
  };

  const handleSaveDiaper = () => {
    addRecord({
      id: Date.now().toString(),
      type: 'diaper',
      startTime: new Date().toISOString(),
      diaperType: diaperType,
      diaperAmount: (diaperType === 'dirty' || diaperType === 'mixed') ? diaperAmount : undefined,
      date: '今天'
    });
    setActiveModal(null);
    showSaveFeedback();
  };

  const handleSaveSleep = () => {
    const today = new Date();
    const [startH, startM] = sleepStart.split(':').map(Number);
    const [endH, endM] = sleepEnd.split(':').map(Number);

    const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), startH, startM);
    const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), endH, endM);

    // Handle overnight
    if (endDate < startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const durationMinutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

    addRecord({
      id: Date.now().toString(),
      type: 'sleep',
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      durationMinutes: durationMinutes,
      date: '今天'
    });
    setActiveModal(null);
    showSaveFeedback();
  };

  const handleSavePump = () => {
    // Construct Start Time from current date + selected time
    const today = new Date();
    const [hours, minutes] = pumpTime.split(':').map(Number);
    today.setHours(hours, minutes, 0, 0);

    addRecord({
      id: Date.now().toString(),
      type: 'pump',
      startTime: today.toISOString(),
      amountMl: pumpAmount,
      date: '今天'
    });
    setActiveModal(null);
    showSaveFeedback();
  };

  return (
    <div className="flex flex-col w-full">
      {/* Header */}
      <header className="flex items-center justify-between px-6 pt-6 pb-4">
        <div
          className="flex items-center gap-3 cursor-pointer"
          onClick={() => {
            if (user) {
              startTransition(() => navigate('/growth'));
            } else {
              setShowLoginModal(true);
            }
          }}
        >
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center text-primary hover:bg-primary/30 transition-colors">
            <span className="material-symbols-outlined">{user ? 'child_care' : 'person_off'}</span>
          </div>
          <div>
            {user ? (
              <>
                <h2 className="text-lg font-bold leading-tight">{babyName || '请填写Baby名称'}</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">今天, {now.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} {now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })}</p>
              </>
            ) : (
              <>
                <h2 className="text-lg font-bold leading-tight text-slate-400">未登录</h2>
                <p className="text-sm text-primary">请点击进行登录 确保功能的正常使用</p>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => startTransition(() => navigate('/reminders'))}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-light dark:bg-surface-dark text-gray-500 hover:text-primary transition-colors"
        >
          <span className="material-symbols-outlined">settings</span>
        </button>
      </header>

      {/* Info Cards */}
      <section className="px-6 mb-6">
        <div className="flex gap-4">
          <div className="flex-1 flex flex-col gap-1 rounded-2xl bg-surface-light dark:bg-surface-dark p-4 shadow-sm border border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">schedule</span>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">上次喂养</p>
            </div>
            <p className="text-2xl font-bold leading-tight">{lastFeedData.val}</p>
            <p className="text-xs text-gray-400">{lastFeedData.suffix}</p>
          </div>
          <div className="flex-1 flex flex-col gap-1 rounded-2xl bg-surface-light dark:bg-surface-dark p-4 shadow-sm border border-gray-100 dark:border-gray-800/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-primary text-[20px]">format_align_right</span>
              <p className="text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">上次侧</p>
            </div>
            <p className="text-2xl font-bold leading-tight">{lastSideData.side}</p>
            <p className="text-xs text-gray-400">{lastSideData.duration}</p>
          </div>
        </div>
      </section>

      {/* Main Timer Section */}
      <main className="flex flex-col items-center w-full px-6 gap-5 mb-8">

        {/* Toggle Switch */}
        <div className="w-full max-w-xs">
          <div className="flex h-12 w-full items-center rounded-2xl bg-surface-light dark:bg-surface-dark p-1 shadow-sm border border-gray-100 dark:border-gray-800/50 relative">
            <div
              className={`absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-primary shadow-sm z-0 transition-all duration-300 ease-out ${selectedSide === 'left' ? 'left-1' : 'left-[calc(50%+2px)]'}`}
            ></div>
            <button
              onClick={() => setSelectedSide('left')}
              className={`z-10 flex flex-1 h-full items-center justify-center rounded-xl font-bold transition-colors ${selectedSide === 'left' ? 'text-primary-content' : 'text-gray-400 hover:text-gray-200'}`}
            >
              左侧
            </button>
            <button
              onClick={() => setSelectedSide('right')}
              className={`z-10 flex flex-1 h-full items-center justify-center rounded-xl font-bold transition-colors ${selectedSide === 'right' ? 'text-primary-content' : 'text-gray-400 hover:text-gray-200'}`}
            >
              右侧
            </button>
          </div>
        </div>

        {/* Timer Circle */}
        <div className="relative flex items-center justify-center py-2">
          <div className="h-60 w-60 rounded-full border-[6px] border-surface-light dark:border-surface-dark flex items-center justify-center shadow-lg relative">
            {/* Animated Ring */}
            <div className={`absolute inset-0 rounded-full border-[6px] border-primary border-t-transparent border-r-transparent -rotate-45 shadow-glow transition-all duration-1000 ${timerRunning ? 'animate-pulse-slow' : ''}`} style={{ clipPath: 'circle(50%)' }}></div>

            <div className="h-48 w-48 rounded-full bg-surface-light dark:bg-surface-dark shadow-inner flex flex-col items-center justify-center z-10">
              <span className="text-gray-400 text-sm font-medium mb-1">喂养时间</span>
              <p className="text-4xl font-bold tracking-tighter text-slate-900 dark:text-white tabular-nums">
                {formatTime(seconds)}
              </p>
              {timerRunning ? (
                <button
                  onClick={handleStop}
                  className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all animate-in zoom-in"
                >
                  <span className="material-symbols-outlined fill text-[20px]">stop</span>
                </button>
              ) : seconds > 0 && !isSaved ? (
                <button
                  onClick={() => resetTimer()}
                  className="mt-3 flex h-10 w-10 items-center justify-center rounded-full bg-gray-500/10 text-gray-500 hover:bg-gray-500 hover:text-white transition-all animate-in zoom-in"
                  title="重置"
                >
                  <span className="material-symbols-outlined text-[20px]">refresh</span>
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 w-full max-w-xs">
          <button
            onClick={() => requireLogin(() => timerRunning ? pauseTimer() : startTimer())}
            className="flex-1 h-12 rounded-2xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white font-bold text-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined fill">{timerRunning ? 'pause' : 'play_arrow'}</span>
            {timerRunning ? '暂停' : '开始'}
          </button>
          <button
            onClick={() => requireLogin(handleSaveTimer)}
            disabled={seconds === 0 && !isSaved}
            className={`flex-1 h-12 rounded-2xl font-bold text-lg transition-all shadow-glow flex items-center justify-center gap-2 ${isSaved
              ? 'bg-green-500 text-white'
              : seconds === 0
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50 shadow-none'
                : 'bg-primary text-primary-content hover:bg-primary/90'
              }`}
          >
            <span className="material-symbols-outlined">{isSaved ? 'check' : 'add'}</span>
            {isSaved ? '已保存' : '记录'}
          </button>
        </div>
      </main>

      {/* Quick Add Section */}
      <section className="px-6 pb-6 mt-auto">
        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">快速添加</h3>
        <div className="grid grid-cols-4 gap-3">
          <button
            onClick={() => requireLogin(() => setActiveModal('bottle'))}
            className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary/50 transition-all active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">water_bottle</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">瓶喂</span>
          </button>
          <button
            onClick={() => requireLogin(() => setActiveModal('diaper'))}
            className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary/50 transition-all active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">layers</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">换尿布</span>
          </button>
          <button
            onClick={() => requireLogin(() => setActiveModal('sleep'))}
            className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary/50 transition-all active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">bedtime</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">睡眠</span>
          </button>
          <button
            onClick={() => requireLogin(() => setActiveModal('pump'))}
            className="group flex flex-col items-center gap-2 p-3 rounded-2xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary/50 transition-all active:scale-95"
          >
            <div className="h-10 w-10 rounded-full bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center group-hover:scale-110 transition-transform">
              <span className="material-symbols-outlined text-[20px]">local_drink</span>
            </div>
            <span className="text-xs font-semibold text-slate-900 dark:text-white">吸奶器</span>
          </button>
        </div>
      </section>

      {/* --- Modals --- */}

      {/* Bottle Modal */}
      <Modal
        isOpen={activeModal === 'bottle'}
        onClose={() => setActiveModal(null)}
        title="瓶喂记录"
        icon="water_bottle"
        onSave={handleSaveBottle}
      >
        <div className="flex flex-col gap-4">
          {/* Time Picker */}
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
            <input
              type="time"
              value={bottleTime}
              onChange={(e) => setBottleTime(e.target.value)}
              className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="border-t border-gray-100 dark:border-white/5 my-1"></div>

          {/* Amount Picker */}
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">奶量 (ml)</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setBottleAmount(prev => Math.max(0, prev - 10))}
                className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl"
              >-</button>
              <div className="flex-1 h-16 bg-surface-light dark:bg-black/20 rounded-2xl border-2 border-primary/20 flex items-center justify-center">
                <input
                  type="number"
                  value={bottleAmount}
                  onChange={(e) => setBottleAmount(Number(e.target.value))}
                  className="bg-transparent border-none text-center text-4xl font-bold text-slate-900 dark:text-white focus:ring-0 w-full p-0"
                />
              </div>
              <button
                onClick={() => setBottleAmount(prev => prev + 10)}
                className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl"
              >+</button>
            </div>
            <div className="flex justify-between mt-3 mb-2">
              {[60, 90, 120, 150].map(val => (
                <button
                  key={val}
                  onClick={() => setBottleAmount(val)}
                  className="px-3 py-1 rounded-lg bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-sm text-slate-500 hover:border-primary hover:text-primary transition-colors"
                >
                  {val}ml
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-white/5 my-1"></div>

          {/* Snack Toggle */}
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase">是否为加餐</span>
              <span className="text-xs text-slate-400 dark:text-gray-600">加餐不计入平均统计</span>
            </div>
            <button
              onClick={() => setIsSnack(!isSnack)}
              className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${isSnack ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`}
            >
              <div className={`absolute top-1 size-5 rounded-full bg-white shadow-sm transition-transform duration-300 ${isSnack ? 'translate-x-6' : 'translate-x-1'}`}></div>
            </button>
          </div>
        </div>
      </Modal>

      {/* Diaper Modal */}
      <Modal
        isOpen={activeModal === 'diaper'}
        onClose={() => setActiveModal(null)}
        title="换尿布记录"
        icon="layers"
        onSave={handleSaveDiaper}
      >
        <div className="flex flex-col gap-5">
          {/* Type Selection */}
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-3 block">状态</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { id: 'wet', label: '小便', icon: 'water_drop' },
                { id: 'dirty', label: '大便', icon: 'sentiment_very_dissatisfied' },
                { id: 'mixed', label: '混合', icon: 'storm' },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => setDiaperType(type.id as any)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${diaperType === type.id
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-transparent bg-surface-light dark:bg-surface-dark text-slate-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                >
                  <span className="material-symbols-outlined">{type.icon}</span>
                  <span className="font-bold">{type.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Amount Selection - Only show for Dirty or Mixed */}
          {(diaperType === 'dirty' || diaperType === 'mixed') && (
            <div className="animate-in slide-in-from-top-2 fade-in duration-300">
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-3 block">分量</label>
              <div className="flex bg-surface-light dark:bg-surface-dark p-1 rounded-xl border border-gray-100 dark:border-white/5">
                {[
                  { id: 'small', label: '少' },
                  { id: 'medium', label: '中' },
                  { id: 'large', label: '多' },
                ].map((amt) => (
                  <button
                    key={amt.id}
                    onClick={() => setDiaperAmount(amt.id as any)}
                    className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${diaperAmount === amt.id
                      ? 'bg-primary text-background-dark shadow-sm'
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                      }`}
                  >
                    {amt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Sleep Modal */}
      <Modal
        isOpen={activeModal === 'sleep'}
        onClose={() => setActiveModal(null)}
        title="睡眠记录"
        icon="bedtime"
        onSave={handleSaveSleep}
      >
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">开始时间</label>
              <input
                type="time"
                value={sleepStart}
                onChange={(e) => setSleepStart(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">结束时间</label>
              <input
                type="time"
                value={sleepEnd}
                onChange={(e) => setSleepEnd(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
          <p className="text-center text-sm text-slate-400 mt-2">记录宝宝的睡眠时段</p>
        </div>
      </Modal>

      {/* Pump Modal */}
      <Modal
        isOpen={activeModal === 'pump'}
        onClose={() => setActiveModal(null)}
        title="吸奶器记录"
        icon="local_drink"
        onSave={handleSavePump}
      >
        <div className="flex flex-col gap-4">
          {/* Time Picker */}
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
            <input
              type="time"
              value={pumpTime}
              onChange={(e) => setPumpTime(e.target.value)}
              className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
            />
          </div>

          <div className="border-t border-gray-100 dark:border-white/5 my-1"></div>

          {/* Amount Picker */}
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">奶量 (ml)</label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setPumpAmount(prev => Math.max(0, prev - 10))}
                className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl"
              >-</button>
              <div className="flex-1 h-16 bg-surface-light dark:bg-black/20 rounded-2xl border-2 border-primary/20 flex items-center justify-center">
                <input
                  type="number"
                  value={pumpAmount === 0 ? '' : pumpAmount}
                  onChange={(e) => setPumpAmount(e.target.value === '' ? 0 : Number(e.target.value))}
                  placeholder="0"
                  className="bg-transparent border-none text-center text-4xl font-bold text-slate-900 dark:text-white focus:ring-0 w-full p-0"
                />
              </div>
              <button
                onClick={() => setPumpAmount(prev => prev + 10)}
                className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl"
              >+</button>
            </div>
            <div className="flex justify-between mt-3 mb-2">
              {[60, 90, 120, 150].map(val => (
                <button
                  key={val}
                  onClick={() => setPumpAmount(val)}
                  className="px-3 py-1 rounded-lg bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-sm text-slate-500 hover:border-primary hover:text-primary transition-colors"
                >
                  {val}ml
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

    </div>
  );
};

export default HomeView;