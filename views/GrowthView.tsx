import React, { useState, useMemo, useEffect, useCallback, memo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { getGrowthLogs, createGrowthLog, GrowthLog as DbGrowthLog } from '../services/database';
import { useAuth } from '../AuthContext';
import { useBaby } from '../BabyContext';

// --- Types ---
type MetricType = 'weight' | 'height' | 'head';

interface GrowthLog {
  id: string;
  type: MetricType;
  value: number;
  date: string; // ISO Date String
}

// --- Constants ---
// Simplified WHO Standards (approximate averages)
const WHO_STANDARDS: Record<MetricType, number[]> = {
  // 0-11 months
  weight: [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.4],
  height: [49.9, 54.7, 58.4, 61.4, 63.9, 65.9, 67.6, 69.2, 70.6, 72.0],
  head: [34.5, 36.9, 38.6, 39.8, 40.8, 41.7, 42.4, 43.0, 43.6, 44.1]
};

const METRIC_CONFIG: Record<MetricType, { label: string; unit: string; color: string; icon: string }> = {
  weight: { label: '体重', unit: 'kg', color: '#2bee6c', icon: 'monitor_weight' },
  height: { label: '身高', unit: 'cm', color: '#a855f7', icon: 'height' },
  head: { label: '头围', unit: 'cm', color: '#f97316', icon: 'face' },
};

// --- Modal Component ---
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  onSave: () => void;
}> = ({ isOpen, onClose, title, children, onSave }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-background-light dark:bg-background-dark rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl transform transition-transform animate-in slide-in-from-bottom duration-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 text-slate-500">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="mb-8">{children}</div>
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

const GrowthView: React.FC = memo(() => {
  const navigate = useNavigate();
  const { user, signOut, setShowLoginModal } = useAuth();
  const { babyName, birthDate, updateBabyProfile } = useBaby();
  const [metric, setMetric] = useState<MetricType>('weight');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Profile Edit Modal State
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");

  // Calculate age string
  const ageLabel = useMemo(() => {
    if (!birthDate) return "";
    const start = new Date(birthDate);
    const end = new Date();
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      if (weeks < 1) return `${diffDays}天大`;
      return `${weeks}周大`;
    }

    const months = Math.floor(diffDays / 30.44);
    const remainingDays = diffDays - (months * 30.44);
    const weeks = Math.floor(remainingDays / 7);

    return `${months}个月${weeks > 0 ? weeks + "周" : ""}大`;
  }, [birthDate]);

  // --- Local Data State ---
  const [logs, setLogs] = useState<GrowthLog[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState(true);

  // Load growth logs from database on mount
  useEffect(() => {
    const loadLogs = async () => {
      try {
        const data = await getGrowthLogs();
        if (data.length > 0) {
          // Convert DbGrowthLog to GrowthLog
          setLogs(data.map(log => ({
            id: log.id,
            type: log.type as MetricType,
            value: log.value,
            date: log.date,
          })));
        }
        // 数据库为空时保持空数组，不初始化静态数据
      } catch (error) {
        console.error('Failed to load growth logs:', error);
      } finally {
        setIsLoadingLogs(false);
      }
    };
    loadLogs();
  }, []);

  // --- Form State ---
  const [inputVal, setInputVal] = useState<string>('');
  const [inputDate, setInputDate] = useState<string>('');

  // --- Helpers ---
  const config = METRIC_CONFIG[metric];

  // 1. Prepare Chart Data
  const chartData = useMemo(() => {
    // Sort logs by date
    const sortedLogs = logs
      .filter(l => l.type === metric)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Map to chart format
    // Simple logic: Use date month as label. Assumes logs are spread out.
    return sortedLogs.map((log, index) => {
      const date = new Date(log.date);
      const label = `${date.getMonth() + 1}月`;
      // Use index to grab WHO standard roughly
      const whoVal = WHO_STANDARDS[metric][index] || 0;

      return {
        month: label,
        value: log.value,
        who: whoVal
      };
    });
  }, [logs, metric]);

  // 2. Current Stat & Trend
  const currentStat = useMemo(() => {
    const sortedLogs = logs
      .filter(l => l.type === metric)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const latest = sortedLogs[0];
    const previous = sortedLogs[1];

    const diff = latest && previous ? latest.value - previous.value : 0;
    const diffSign = diff > 0 ? '+' : '';

    return {
      value: latest ? latest.value : 0,
      diffLabel: latest && previous ? `${diffSign}${diff.toFixed(1)} ${config.unit}` : '--',
      isUp: diff >= 0
    };
  }, [logs, metric, config.unit]);

  // 3. Recent Logs List
  const recentLogs = useMemo(() => {
    return logs
      .filter(l => l.type === metric)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs, metric]);

  // --- Handlers ---
  const handleOpenAdd = () => {
    // Default to now
    const now = new Date();
    // Format for datetime-local input: YYYY-MM-DDTHH:mm
    const dateStr = now.getFullYear() + '-' +
      String(now.getMonth() + 1).padStart(2, '0') + '-' +
      String(now.getDate()).padStart(2, '0') + 'T' +
      String(now.getHours()).padStart(2, '0') + ':' +
      String(now.getMinutes()).padStart(2, '0');

    setInputDate(dateStr);
    setInputVal('');
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!inputVal || !inputDate) return;

    const newLogData = {
      type: metric,
      value: parseFloat(inputVal),
      date: new Date(inputDate).toISOString()
    };

    // Optimistically add to UI
    const tempLog: GrowthLog = {
      id: Date.now().toString(),
      ...newLogData
    };
    setLogs(prev => [...prev, tempLog]);
    setIsModalOpen(false);

    // Persist to database
    const saved = await createGrowthLog(newLogData);
    if (saved) {
      setLogs(prev => prev.map(l => l.id === tempLog.id ? { ...l, id: saved.id } : l));
    }
  };

  // Profile Handlers
  const handleOpenProfileEdit = () => {
    setEditName(babyName);
    setEditBirthDate(birthDate);
    setIsProfileModalOpen(true);
  };

  const handleSaveProfile = async () => {
    if (editName.trim() || editBirthDate) {
      await updateBabyProfile(editName.trim(), editBirthDate);
    }
    setIsProfileModalOpen(false);
  };

  // Helper date formatter
  const formatListDate = (isoStr: string) => {
    const d = new Date(isoStr);
    const today = new Date();
    const isToday = d.toDateString() === today.toDateString();

    const datePart = isToday ? '今天' : `${d.getMonth() + 1}月${d.getDate()}日`;
    const timePart = d.toLocaleTimeString('zh-CN', { hour: 'numeric', minute: '2-digit', hour12: true });

    return { datePart, timePart };
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark pb-24">
      {/* Sticky Header */}
      <div className="sticky top-0 z-20 flex items-center justify-between bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm p-4 pb-2 transition-colors">
        <button
          onClick={() => startTransition(() => navigate(-1))}
          className="flex size-10 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors text-slate-900 dark:text-white"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <h2 className="text-lg font-bold leading-tight tracking-tight flex-1 text-center pr-10">成长档案</h2>
      </div>

      <div className="flex flex-col items-center gap-4 px-4 pt-4 pb-6">
        <div className="relative group cursor-pointer" onClick={() => user ? handleOpenProfileEdit() : setShowLoginModal(true)}>
          <div
            className="h-28 w-28 rounded-full bg-surface-dark bg-center bg-cover border-4 border-primary/30 shadow-xl flex items-center justify-center overflow-hidden"
            style={{ backgroundImage: 'url("https://pub-141831e61e69445289222976a15b6fb3.r2.dev/Image_to_url_V2/2961acfdb72778ce59c1bdb7cdd58a2f-imagetourl.cloud-1769854736932-p60gi5.jpeg")' }}
          >
          </div>
          <div className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-background-dark shadow-md border-2 border-background-dark">
            <span className="material-symbols-outlined text-[18px]">edit</span>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center text-center">
          <h1 className="text-2xl font-bold leading-tight">{babyName || '未填写'}</h1>
          <p className="text-primary font-medium mt-1">{ageLabel || '请点击编辑填写信息'}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-4 mb-6">
        <div className="flex h-12 w-full items-center rounded-xl bg-slate-200 dark:bg-surface-dark p-1">
          {(['weight', 'height', 'head'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`relative flex h-full flex-1 cursor-pointer items-center justify-center rounded-lg px-2 transition-all ${metric === m ? 'bg-primary shadow-sm text-background-dark' : 'text-slate-500 dark:text-slate-400 hover:bg-black/5 dark:hover:bg-white/5'}`}
            >
              <span className="relative z-10 text-sm font-bold transition-colors">
                {m === 'weight' ? '体重' : m === 'height' ? '身高' : '头围'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Chart Card */}
      <div className="px-4 mb-8">
        <div className="rounded-2xl bg-white dark:bg-surface-dark p-5 shadow-sm border border-slate-100 dark:border-white/5">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-1">当前{config.label}</p>
              <h3 className="text-3xl font-bold tracking-tight">{currentStat.value} {config.unit}</h3>
            </div>
            <div className={`flex items-center gap-1 rounded-full px-3 py-1 ${currentStat.isUp ? 'bg-primary/10' : 'bg-red-500/10'}`}>
              <span className={`material-symbols-outlined text-sm font-bold ${currentStat.isUp ? 'text-primary' : 'text-red-500'}`}>
                {currentStat.isUp ? 'trending_up' : 'trending_down'}
              </span>
              <span className={`text-xs font-bold ${currentStat.isUp ? 'text-primary' : 'text-red-500'}`}>
                {currentStat.diffLabel}
              </span>
            </div>
          </div>

          <div className="relative h-48 w-full mb-2">
            <div className="absolute top-0 right-0 z-10 flex gap-4 text-[10px] font-medium text-slate-400">
              <div className="flex items-center gap-1">
                <div className="h-0.5 w-3 bg-slate-500 border border-slate-500 border-dashed"></div> WHO
              </div>
              <div className="flex items-center gap-1">
                <div className="h-1 w-3 rounded-full" style={{ backgroundColor: config.color }}></div> Leo
              </div>
            </div>

            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={config.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={config.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Tooltip
                  contentStyle={{ backgroundColor: '#102216', border: 'none', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }}
                  itemStyle={{ color: config.color }}
                  labelStyle={{ display: 'none' }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={config.color}
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
                <Area
                  type="monotone"
                  dataKey="who"
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  fill="transparent"
                />
                <XAxis
                  dataKey="month"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  dy={10}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Recent Measurements List */}
      <div className="flex items-center justify-between px-4 mb-3">
        <h3 className="text-lg font-bold tracking-tight">最近测量 ({config.label})</h3>

      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">
        {recentLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-slate-400 dark:text-gray-500">
            <span className="material-symbols-outlined text-3xl mb-2">monitoring</span>
            <p className="font-medium">暂无数据信息</p>
            <p className="text-xs mt-1">点击右下角按钮添加{config.label}记录</p>
          </div>
        ) : (
          recentLogs.map((item) => {
            const { datePart, timePart } = formatListDate(item.date);
            return (
              <div key={item.id} className="flex items-center gap-4 rounded-xl bg-white dark:bg-surface-dark p-4 shadow-sm border border-slate-100 dark:border-white/5">
                <div
                  className="flex size-12 items-center justify-center rounded-full text-white"
                  style={{ backgroundColor: `${config.color}20`, color: config.color }}
                >
                  <span className="material-symbols-outlined">{config.icon}</span>
                </div>
                <div className="flex flex-1 flex-col">
                  <p className="text-base font-bold text-slate-900 dark:text-white">{item.value} {config.unit}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{config.label}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{datePart}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-500">{timePart}</p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FAB - Open Modal */}
      <button
        onClick={handleOpenAdd}
        className="fixed bottom-6 right-6 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-background-dark shadow-lg shadow-primary/30 transition-transform hover:scale-105 active:scale-95"
      >
        <span className="material-symbols-outlined text-[32px]">add</span>
      </button>

      {/* Add Record Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={`添加${config.label}记录`}
        onSave={handleSave}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
              {config.label} ({config.unit})
            </label>
            <div className="flex items-center bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 px-4">
              <input
                type="number"
                step="0.1"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder={`请输入${config.label}`}
                className="flex-1 bg-transparent border-none text-xl font-bold text-slate-900 dark:text-white h-14 focus:ring-0 p-0"
              />
              <span className="text-slate-500 font-bold">{config.unit}</span>
            </div>
          </div>
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
              测量时间
            </label>
            <input
              type="datetime-local"
              value={inputDate}
              onChange={(e) => setInputDate(e.target.value)}
              className="w-full bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 h-14 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary"
            />
          </div>
        </div>
      </Modal>

      {/* Profile Edit Modal */}
      <Modal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        title="编辑宝宝档案"
        onSave={handleSaveProfile}
      >
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
              宝宝姓名
            </label>
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="w-full bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 h-14 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary text-lg font-bold"
              placeholder="请输入宝宝姓名"
            />
          </div>
          <div>
            <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">
              出生日期
            </label>
            <input
              type="date"
              value={editBirthDate}
              onChange={(e) => setEditBirthDate(e.target.value)}
              className="w-full bg-surface-light dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 h-14 text-slate-900 dark:text-white px-4 focus:ring-primary focus:border-primary text-lg font-bold"
            />
          </div>

          {/* 退出登录按钮 */}
          {user && (
            <button
              onClick={async () => {
                await signOut();
                setIsProfileModalOpen(false);
                startTransition(() => navigate('/'));
              }}
              className="w-full h-12 rounded-xl bg-red-500/10 text-red-500 font-bold hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2 mt-4"
            >
              <span className="material-symbols-outlined">logout</span>
              退出登录
            </button>
          )}
        </div>
      </Modal>

    </div >
  );
});

export default GrowthView;