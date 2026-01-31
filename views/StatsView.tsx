import React, { useState, useMemo, useCallback, memo, startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart, Bar, Cell, ResponsiveContainer } from 'recharts';
import { useRecords } from '../App';
import { FeedRecord, RecordType } from '../types';

// --- Reuse Modal Component ---
const Modal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  title: string;
  icon: string;
  children: React.ReactNode;
  onSave?: () => void;
  saveLabel?: string;
  hideSave?: boolean;
  onDelete?: () => void;
}> = ({ isOpen, onClose, title, icon, children, onSave, saveLabel = "保存修改", hideSave = false, onDelete }) => {
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

        <div className="mb-6">
          {children}
        </div>

        <div className="flex flex-col gap-3">
          {!hideSave && (
            <button
              onClick={onSave}
              className="w-full h-12 rounded-2xl bg-primary text-primary-content font-bold text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 shadow-glow"
            >
              {saveLabel}
            </button>
          )}
          {onDelete && (
            <button
              onClick={onDelete}
              className="w-full h-12 rounded-2xl bg-red-500/10 text-red-500 font-bold text-base hover:bg-red-500/20 transition-colors flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[20px]">delete</span>
              删除记录
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

type FilterType = 'all' | 'feed' | 'diaper' | 'sleep' | 'pump';

const StatsView: React.FC = memo(() => {
  const navigate = useNavigate();
  const { records, updateRecord, deleteRecord } = useRecords();

  // Delete handler
  const handleDeleteRecord = () => {
    if (editingRecord) {
      deleteRecord(editingRecord.id);
      setEditingRecord(null);
    }
  };

  // --- Filter & Date State ---
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [showDateModal, setShowDateModal] = useState(false);

  // --- Edit State ---
  const [editingRecord, setEditingRecord] = useState<FeedRecord | null>(null);

  // Generic Time State
  const [editStartTime, setEditStartTime] = useState<string>('');

  // Bottle State
  const [bottleAmount, setBottleAmount] = useState<number>(0);

  // Diaper State
  const [diaperType, setDiaperType] = useState<'wet' | 'dirty' | 'mixed'>('wet');
  const [diaperAmount, setDiaperAmount] = useState<'small' | 'medium' | 'large'>('medium');

  // Sleep State
  const [sleepEnd, setSleepEnd] = useState<string>('');

  // Breast State
  const [breastSide, setBreastSide] = useState<'left' | 'right'>('left');
  const [breastDuration, setBreastDuration] = useState<number>(0);
  const [breastSeconds, setBreastSeconds] = useState<number>(0);

  // Helper for date equality
  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getDate() === d2.getDate() &&
      d1.getMonth() === d2.getMonth() &&
      d1.getFullYear() === d2.getFullYear();
  };

  // --- Calculated Statistics ---

  // 1. Chart Data: Weekly Average Bottle Amount per Day (Excluding Snacks)
  const chartData = useMemo(() => {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    const today = new Date();

    const data = [];
    let totalWeekAmount = 0;
    let totalWeekCount = 0;

    // Iterate last 7 days (including today)
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);

      const dayRecords = records.filter(r =>
        r.type === 'bottle' && isSameDay(new Date(r.startTime), d) && !r.isSnack
      );

      const daySum = dayRecords.reduce((sum, r) => sum + (r.amountMl || 0), 0);
      const dayCount = dayRecords.length;
      const dayAvg = dayCount > 0 ? Math.round(daySum / dayCount) : 0;

      totalWeekAmount += daySum;
      totalWeekCount += dayCount;

      data.push({
        day: days[d.getDay()],
        val: dayAvg,
        active: isSameDay(d, today)
      });
    }

    // Weekly Average (Average of all bottle feeds in the week)
    const weeklyAvg = totalWeekCount > 0 ? Math.round(totalWeekAmount / totalWeekCount) : 0;

    return { data, weeklyAvg };
  }, [records]);

  // 2. Today vs Yesterday Comparison Logic (Excluding Snacks)
  const todayComparison = useMemo(() => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    const getAvgForDay = (date: Date) => {
      const targetRecords = records.filter(r =>
        r.type === 'bottle' &&
        new Date(r.startTime).getDate() === date.getDate() &&
        new Date(r.startTime).getMonth() === date.getMonth() &&
        new Date(r.startTime).getFullYear() === date.getFullYear() &&
        !r.isSnack
      );

      if (targetRecords.length === 0) return 0;
      const total = targetRecords.reduce((sum, r) => sum + (r.amountMl || 0), 0);
      return Math.round(total / targetRecords.length);
    };

    const todayAvg = getAvgForDay(today);
    const yesterdayAvg = getAvgForDay(yesterday);
    const diff = todayAvg - yesterdayAvg;

    return { todayAvg, diff };
  }, [records]);

  // 3. Summary Cards Data (Based on Selected Date for Breast, but specifically Today for Bottle in card 2)
  const summaryStats = useMemo(() => {
    const dayRecords = records.filter(r => isSameDay(new Date(r.startTime), selectedDate));

    // Card 1: Total Breastfeeding Duration
    const breastRecords = dayRecords.filter(r => r.type === 'breast');

    // Summing seconds if available, otherwise converting minutes
    const totalSeconds = breastRecords.reduce((sum, r) => {
      if (r.durationSeconds !== undefined) return sum + r.durationSeconds;
      return sum + (r.durationMinutes || 0) * 60;
    }, 0);

    const breastHours = Math.floor(totalSeconds / 3600);
    const breastMins = Math.floor((totalSeconds % 3600) / 60);
    const breastSecs = totalSeconds % 60;

    // Display format based on precision
    let breastDurationDisplay = '';
    if (breastHours > 0) {
      breastDurationDisplay = `${breastHours}小时 ${breastMins}分`;
    } else if (breastMins > 0) {
      breastDurationDisplay = `${breastMins}分 ${breastSecs}秒`;
    } else {
      breastDurationDisplay = `${breastSecs}秒`;
    }

    return {
      breastDurationDisplay,
    };
  }, [records, selectedDate]);


  // Filtered Records Logic for List
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // 1. Filter by Date
      if (!isSameDay(new Date(record.startTime), selectedDate)) return false;

      // 2. Filter by Type
      if (activeFilter === 'all') return true;
      if (activeFilter === 'feed') return record.type === 'breast' || record.type === 'bottle';
      if (activeFilter === 'diaper') return record.type === 'diaper';
      if (activeFilter === 'sleep') return record.type === 'sleep';
      if (activeFilter === 'pump') return record.type === 'pump';

      return true;
    });
  }, [records, activeFilter, selectedDate]);

  const handleEditClick = (record: FeedRecord) => {
    setEditingRecord(record);

    // Common time init
    const start = new Date(record.startTime);
    setEditStartTime(start.toTimeString().slice(0, 5));

    if (record.type === 'bottle') {
      setBottleAmount(record.amountMl || 0);
    } else if (record.type === 'diaper') {
      setDiaperType(record.diaperType || 'wet');
      setDiaperAmount(record.diaperAmount || 'medium');
    } else if (record.type === 'sleep') {
      if (record.endTime) {
        setSleepEnd(new Date(record.endTime).toTimeString().slice(0, 5));
      } else {
        setSleepEnd('');
      }
    } else if (record.type === 'breast') {
      setBreastSide(record.side || 'left');

      if (record.durationSeconds !== undefined) {
        setBreastDuration(Math.floor(record.durationSeconds / 60));
        setBreastSeconds(record.durationSeconds % 60);
      } else {
        setBreastDuration(record.durationMinutes || 0);
        setBreastSeconds(0);
      }
    } else if (record.type === 'pump') {
      setBottleAmount(record.amountMl || 0);
    }
  };

  const handleSaveEdit = () => {
    if (!editingRecord) return;

    // Helper to update hours/minutes of existing date
    const updateTime = (originalIso: string, timeStr: string) => {
      const d = new Date(originalIso);
      const [h, m] = timeStr.split(':').map(Number);
      d.setHours(h, m);
      return d.toISOString();
    };

    const newStartTime = updateTime(editingRecord.startTime, editStartTime);

    let updatedRecord: FeedRecord = {
      ...editingRecord,
      startTime: newStartTime,
    };

    if (editingRecord.type === 'bottle') {
      updatedRecord = { ...updatedRecord, amountMl: bottleAmount };
    } else if (editingRecord.type === 'diaper') {
      updatedRecord = {
        ...updatedRecord,
        diaperType,
        diaperAmount: (diaperType === 'dirty' || diaperType === 'mixed') ? diaperAmount : undefined
      };
    } else if (editingRecord.type === 'sleep') {
      // Recalculate duration if start/end changes
      const startD = new Date(newStartTime);
      const endD = new Date(newStartTime);
      if (sleepEnd) {
        const [h, m] = sleepEnd.split(':').map(Number);
        endD.setHours(h, m);
        // Handle overnight
        if (endD < startD) endD.setDate(endD.getDate() + 1);

        updatedRecord = {
          ...updatedRecord,
          endTime: endD.toISOString(),
          durationMinutes: Math.round((endD.getTime() - startD.getTime()) / 60000)
        }
      }
    } else if (editingRecord.type === 'breast') {
      const totalSeconds = breastDuration * 60 + breastSeconds;
      updatedRecord = {
        ...updatedRecord,
        side: breastSide,
        durationMinutes: Math.max(0, Math.ceil(totalSeconds / 60)), // Calculated based on seconds
        durationSeconds: totalSeconds // Precise seconds
      };
    } else if (editingRecord.type === 'pump') {
      updatedRecord = { ...updatedRecord, amountMl: bottleAmount };
    }

    updateRecord(editingRecord.id, updatedRecord);
    setEditingRecord(null);
  };

  const handleBreastTimeChange = (type: 'min' | 'sec', delta: number) => {
    if (type === 'min') {
      setBreastDuration(d => Math.max(0, d + delta));
    } else {
      let newSec = breastSeconds + delta;
      if (newSec >= 60) {
        setBreastDuration(d => d + 1);
        setBreastSeconds(0);
      } else if (newSec < 0) {
        if (breastDuration > 0) {
          setBreastDuration(d => d - 1);
          setBreastSeconds(59);
        } else {
          setBreastSeconds(0);
        }
      } else {
        setBreastSeconds(newSec);
      }
    }
  };

  // Helper to format record for display
  const getDisplayData = (record: FeedRecord) => {
    let title = '';
    let duration = '';
    let icon = '';
    let color = '';

    switch (record.type) {
      case 'breast':
        title = record.side === 'left' ? '左侧母乳' : '右侧母乳';
        if (record.durationSeconds !== undefined) {
          const m = Math.floor(record.durationSeconds / 60);
          const s = record.durationSeconds % 60;
          if (m > 0) duration = `${m}分${s}秒`;
          else duration = `${s}秒`;
        } else {
          duration = `${record.durationMinutes}分钟`;
        }
        icon = 'water_drop';
        color = record.side === 'left' ? 'indigo' : 'pink';
        break;
      case 'bottle':
        title = '瓶喂';
        if (record.isSnack) {
          title += ' (加餐)';
        }
        duration = `${record.amountMl}毫升`;
        icon = 'water_bottle';
        color = 'blue';
        break;
      case 'diaper':
        const typeMap = { wet: '小便', dirty: '大便', mixed: '混合' };
        const amountMap = { small: '少', medium: '中', large: '多' };
        let typeStr = typeMap[record.diaperType || 'wet'];

        // Append amount if it exists and type is dirty or mixed
        if (record.diaperAmount && (record.diaperType === 'dirty' || record.diaperType === 'mixed')) {
          typeStr += ` (${amountMap[record.diaperAmount]})`;
        }

        title = `换尿布 - ${typeStr}`;
        duration = '';
        icon = 'layers';
        color = 'orange';
        break;
      case 'sleep':
        title = '睡眠';
        duration = record.durationMinutes ? (
          record.durationMinutes > 60
            ? `${Math.floor(record.durationMinutes / 60)}小时${record.durationMinutes % 60}分`
            : `${record.durationMinutes}分钟`
        ) : '计时中';
        icon = 'bedtime';
        color = 'purple';
        break;
      case 'pump':
        title = '吸奶器';
        duration = `${record.amountMl}毫升`;
        icon = 'local_drink';
        color = 'teal';
        break;
    }

    return {
      title,
      time: new Date(record.startTime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      duration,
      icon,
      color
    };
  };

  const formatDateLabel = (date: Date) => {
    const today = new Date();
    if (date.toDateString() === today.toDateString()) return '今天';

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return '昨天';

    return `${date.getMonth() + 1}月${date.getDate()}日`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-background-light dark:bg-background-dark">
      {/* Header */}
      <div className="flex items-center px-4 py-4 pt-6 justify-between sticky top-0 z-10 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-sm">
        <div
          onClick={() => startTransition(() => navigate('/'))}
          className="flex size-10 shrink-0 items-center justify-center rounded-full active:bg-slate-200 dark:active:bg-[#28392e] transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-slate-900 dark:text-white" style={{ fontSize: '24px' }}>arrow_back</span>
        </div>
        <h2 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em] flex-1 text-center pr-10">数据统计</h2>
      </div>

      <div className="flex-1 flex flex-col px-4 pb-24">
        {/* Weekly Chart Card */}
        <div className="mt-2 flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-[#3b5443] bg-white dark:bg-[#1a2c20] p-5 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-slate-500 dark:text-[#9db9a6] text-sm font-medium leading-normal">周概览</p>
                <p className="text-slate-900 dark:text-white tracking-light text-[32px] font-bold leading-tight mt-1">
                  {chartData.weeklyAvg}毫升
                </p>
                <p className="text-xs text-slate-400 dark:text-[#5c7a65] font-medium mt-1">平均奶量</p>
              </div>

              {/* Today vs Yesterday Comparison Badge */}
              <div className={`flex gap-1 items-center px-2 py-1 rounded-lg ${todayComparison.diff >= 0
                ? 'bg-green-100 dark:bg-primary/20 text-green-600 dark:text-primary'
                : 'bg-orange-100 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400'
                }`}>
                <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>
                  {todayComparison.diff >= 0 ? 'trending_up' : 'trending_down'}
                </span>
                <span className="text-xs font-bold">
                  {Math.abs(todayComparison.diff)}ml
                </span>
              </div>
            </div>

            {/* Custom Bar Chart Representation matching design */}
            <div className="grid h-[160px] grid-cols-7 gap-3 items-end justify-items-center mt-2">
              {chartData.data.map((d, i) => (
                <div key={i} className="flex flex-col items-center gap-2 w-full h-full justify-end group cursor-pointer">

                  {/* Chart Column Wrapper - Flex-1 to fill space above text */}
                  <div className="relative w-full flex-1 flex items-end">

                    {/* Tooltip */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10 ease-out transform translate-y-1 group-hover:translate-y-0"
                      style={{ bottom: `${Math.min(100, (d.val / 200) * 100)}%` }}
                    >
                      <div className="bg-slate-800 dark:bg-white text-white dark:text-slate-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center justify-center shadow-lg whitespace-nowrap">
                        {d.val}ml
                      </div>
                      {/* Arrow */}
                      <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[1px] border-[3px] border-transparent border-t-slate-800 dark:border-t-white"></div>
                    </div>

                    {/* Bar Track */}
                    <div className="relative w-full rounded-md bg-slate-100 dark:bg-white/5 overflow-hidden h-full flex items-end">
                      <div
                        className={`w-full rounded-md transition-all duration-300 ${d.active ? 'bg-green-500 dark:bg-primary shadow-[0_0_12px_rgba(43,238,108,0.4)]' : 'bg-slate-300 dark:bg-white/10 group-hover:bg-primary/50'}`}
                        style={{ height: `${Math.min(100, (d.val / 200) * 100)}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Day Label */}
                  <p className={`text-xs font-bold transition-colors ${d.active ? 'text-green-600 dark:text-primary' : 'text-slate-400 dark:text-[#5c7a65] group-hover:text-primary'}`}>{d.day}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="flex flex-wrap gap-4 mt-4">

          {/* Card 1: Total Breastfeeding Time */}
          <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-5 bg-white dark:bg-[#1a2c20] border border-slate-100 dark:border-[#28392e] shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-slate-400 dark:text-[#5c7a65]" style={{ fontSize: '20px' }}>schedule</span>
              <p className="text-slate-500 dark:text-[#9db9a6] text-sm font-medium leading-normal">母乳总时长</p>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold leading-tight">
              {summaryStats.breastDurationDisplay}
            </p>
          </div>

          {/* Card 2: Today's Average Bottle Amount */}
          <div className="flex min-w-[140px] flex-1 flex-col gap-1 rounded-xl p-5 bg-white dark:bg-[#1a2c20] border border-slate-100 dark:border-[#28392e] shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <span className="material-symbols-outlined text-slate-400 dark:text-[#5c7a65]" style={{ fontSize: '20px' }}>water_bottle</span>
              <p className="text-slate-500 dark:text-[#9db9a6] text-sm font-medium leading-normal">今日平均奶量</p>
            </div>
            <p className="text-slate-900 dark:text-white tracking-tight text-2xl font-bold leading-tight">
              {todayComparison.todayAvg}毫升
            </p>
          </div>

        </div>

        {/* Records Header with Date Picker */}
        <div className="flex flex-col gap-4 mt-8">
          <div className="flex justify-between items-center px-1">
            <h3 className="text-slate-900 dark:text-white text-lg font-bold leading-tight tracking-[-0.015em]">数据记录</h3>
            <button
              onClick={() => setShowDateModal(true)}
              className="flex items-center gap-1 text-sm font-bold text-slate-500 dark:text-[#9db9a6] hover:text-primary transition-colors bg-slate-100 dark:bg-[#28392e] px-3 py-1.5 rounded-lg"
            >
              {formatDateLabel(selectedDate)}
              <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            </button>
          </div>

          {/* Filter Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar px-1 pb-2">
            {[
              { id: 'all', label: '综合' },
              { id: 'feed', label: '喂养' },
              { id: 'diaper', label: '换尿布' },
              { id: 'sleep', label: '睡眠' },
              { id: 'pump', label: '吸奶器' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveFilter(tab.id as FilterType)}
                className={`whitespace-nowrap px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeFilter === tab.id
                  ? 'bg-primary text-primary-content shadow-lg shadow-primary/20'
                  : 'bg-white dark:bg-[#1a2c20] text-slate-500 dark:text-gray-400 border border-slate-100 dark:border-[#28392e] hover:border-primary/50'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Log List (Filtered) */}
        <div className="flex flex-col gap-3 mt-2">
          {filteredRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-gray-600">
              <div className="bg-slate-100 dark:bg-[#1a2c20] p-4 rounded-full mb-3">
                <span className="material-symbols-outlined text-4xl">history_toggle_off</span>
              </div>
              <p className="font-medium">暂无数据信息</p>
              <p className="text-xs mt-1">点击右下角按钮添加</p>
            </div>
          ) : (
            filteredRecords.map((record) => {
              const display = getDisplayData(record);
              return (
                <div key={record.id} className="group flex items-center gap-4 bg-white dark:bg-[#1a2c20] p-4 rounded-xl border border-transparent hover:border-green-200 dark:hover:border-primary/30 transition-all shadow-sm">
                  <div className={`flex items-center justify-center rounded-lg bg-${display.color}-50 dark:bg-${display.color}-900/20 text-${display.color}-500 dark:text-${display.color}-400 shrink-0 size-12`}>
                    <span className="material-symbols-outlined" style={{ fontSize: '24px' }}>{display.icon}</span>
                  </div>
                  <div className="flex flex-col flex-1 gap-0.5">
                    <p className="text-slate-900 dark:text-white text-base font-bold leading-normal">{display.title}</p>
                    <p className="text-slate-500 dark:text-[#9db9a6] text-xs font-medium">{display.time}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <p className="text-slate-900 dark:text-white text-sm font-bold">{display.duration}</p>
                    <div
                      onClick={() => handleEditClick(record)}
                      className="size-8 flex items-center justify-center rounded-full text-slate-400 hover:text-green-600 dark:hover:text-primary hover:bg-slate-100 dark:hover:bg-[#28392e] transition-colors cursor-pointer"
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>edit</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        <div className="h-6 w-full"></div>
      </div>

      {/* --- Date Picker Modal --- */}
      <Modal
        isOpen={showDateModal}
        onClose={() => setShowDateModal(false)}
        title="选择日期"
        icon="calendar_month"
        hideSave={true}
      >
        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setSelectedDate(new Date()); setShowDateModal(false); }}
            className="w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary flex items-center justify-between group"
          >
            <span className="font-bold text-slate-900 dark:text-white">今天</span>
            {new Date().toDateString() === selectedDate.toDateString() && <span className="material-symbols-outlined text-primary">check</span>}
          </button>

          <button
            onClick={() => {
              const d = new Date(); d.setDate(d.getDate() - 1);
              setSelectedDate(d);
              setShowDateModal(false);
            }}
            className="w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-transparent hover:border-primary flex items-center justify-between group"
          >
            <span className="font-bold text-slate-900 dark:text-white">昨天</span>
            {(() => {
              const d = new Date(); d.setDate(d.getDate() - 1);
              return d.toDateString() === selectedDate.toDateString();
            })() && <span className="material-symbols-outlined text-primary">check</span>}
          </button>

          <div className="relative w-full">
            <input
              type="date"
              value={selectedDate.toISOString().split('T')[0]}
              onChange={(e) => {
                if (e.target.value) {
                  setSelectedDate(new Date(e.target.value));
                  setShowDateModal(false);
                }
              }}
              className="w-full p-4 rounded-xl bg-surface-light dark:bg-surface-dark border border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white font-bold focus:ring-primary focus:border-primary"
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <span className="material-symbols-outlined text-slate-400">edit_calendar</span>
            </div>
          </div>
        </div>
      </Modal>

      {/* --- Edit Modals --- */}

      {/* Bottle Edit Modal */}
      {editingRecord?.type === 'bottle' && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRecord(null)}
          title="修改瓶喂"
          icon="water_bottle"
          onSave={handleSaveEdit}
          onDelete={handleDeleteRecord}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">奶量 (ml)</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setBottleAmount(p => Math.max(0, p - 10))} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl">-</button>
                <div className="flex-1 h-16 bg-surface-light dark:bg-black/20 rounded-2xl border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                  <input
                    type="number"
                    value={bottleAmount}
                    onChange={(e) => setBottleAmount(Number(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-4xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0"
                    style={{ MozAppearance: 'textfield' }}
                  />
                </div>
                <button onClick={() => setBottleAmount(p => p + 10)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl">+</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Diaper Edit Modal */}
      {editingRecord?.type === 'diaper' && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRecord(null)}
          title="修改尿布"
          icon="layers"
          onSave={handleSaveEdit}
          onDelete={handleDeleteRecord}
        >
          <div className="flex flex-col gap-5">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
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
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${diaperType === type.id ? 'border-primary bg-primary/10 text-primary' : 'border-transparent bg-surface-light dark:bg-surface-dark text-slate-500 dark:text-gray-400'}`}
                  >
                    <span className="material-symbols-outlined">{type.icon}</span>
                    <span className="font-bold">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
            {(diaperType === 'dirty' || diaperType === 'mixed') && (
              <div className="animate-in slide-in-from-top-2 fade-in duration-300">
                <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-3 block">分量</label>
                <div className="flex bg-surface-light dark:bg-surface-dark p-1 rounded-xl border border-gray-100 dark:border-white/5">
                  {[{ id: 'small', label: '少' }, { id: 'medium', label: '中' }, { id: 'large', label: '多' }].map((amt) => (
                    <button
                      key={amt.id}
                      onClick={() => setDiaperAmount(amt.id as any)}
                      className={`flex-1 py-3 rounded-lg text-sm font-bold transition-all ${diaperAmount === amt.id ? 'bg-primary text-background-dark shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                    >
                      {amt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Sleep Edit Modal */}
      {editingRecord?.type === 'sleep' && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRecord(null)}
          title="修改睡眠"
          icon="bedtime"
          onSave={handleSaveEdit}
          onDelete={handleDeleteRecord}
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">开始时间</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
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
        </Modal>
      )}

      {/* Breast Edit Modal */}
      {editingRecord?.type === 'breast' && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRecord(null)}
          title="修改母乳"
          icon="water_drop"
          onSave={handleSaveEdit}
          onDelete={handleDeleteRecord}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setBreastSide('left')} className={`h-14 rounded-xl font-bold border-2 transition-colors ${breastSide === 'left' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-light dark:bg-surface-dark border-transparent text-slate-500'}`}>左侧</button>
              <button onClick={() => setBreastSide('right')} className={`h-14 rounded-xl font-bold border-2 transition-colors ${breastSide === 'right' ? 'bg-primary/20 border-primary text-primary' : 'bg-surface-light dark:bg-surface-dark border-transparent text-slate-500'}`}>右侧</button>
            </div>

            <div className="flex gap-4">
              {/* Minutes */}
              <div className="flex-1">
                <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">分钟</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleBreastTimeChange('min', -1)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all">-</button>
                  <div className="flex-1 h-12 bg-surface-light dark:bg-black/20 rounded-xl border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                    <input
                      type="number"
                      value={breastDuration}
                      onChange={(e) => setBreastDuration(Math.max(0, Number(e.target.value)))}
                      className="w-full h-full bg-transparent border-none text-center text-xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0"
                      style={{ MozAppearance: 'textfield' }}
                    />
                  </div>
                  <button onClick={() => handleBreastTimeChange('min', 1)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all">+</button>
                </div>
              </div>

              {/* Seconds */}
              <div className="flex-1">
                <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">秒</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleBreastTimeChange('sec', -1)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all">-</button>
                  <div className="flex-1 h-12 bg-surface-light dark:bg-black/20 rounded-xl border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                    <input
                      type="number"
                      value={breastSeconds}
                      onChange={(e) => {
                        const val = Math.max(0, Number(e.target.value));
                        setBreastSeconds(val);
                      }}
                      onBlur={() => {
                        if (breastSeconds >= 60) {
                          setBreastDuration(d => d + Math.floor(breastSeconds / 60));
                          setBreastSeconds(s => s % 60);
                        }
                      }}
                      className="w-full h-full bg-transparent border-none text-center text-xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0"
                      style={{ MozAppearance: 'textfield' }}
                    />
                  </div>
                  <button onClick={() => handleBreastTimeChange('sec', 1)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-xl hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all">+</button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Pump Edit Modal */}
      {editingRecord?.type === 'pump' && (
        <Modal
          isOpen={true}
          onClose={() => setEditingRecord(null)}
          title="修改吸奶器"
          icon="local_drink"
          onSave={handleSaveEdit}
          onDelete={handleDeleteRecord}
        >
          <div className="flex flex-col gap-4">
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">时间</label>
              <input
                type="time"
                value={editStartTime}
                onChange={(e) => setEditStartTime(e.target.value)}
                className="w-full h-14 bg-surface-light dark:bg-surface-dark rounded-xl border-gray-200 dark:border-gray-700 text-slate-900 dark:text-white text-xl text-center focus:ring-primary focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm text-slate-500 dark:text-gray-400 font-bold uppercase mb-2 block">奶量 (ml)</label>
              <div className="flex items-center gap-4">
                <button onClick={() => setBottleAmount(p => Math.max(0, p - 10))} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl">-</button>
                <div className="flex-1 h-16 bg-surface-light dark:bg-black/20 rounded-2xl border-2 border-primary/20 flex items-center justify-center relative overflow-hidden">
                  <input
                    type="number"
                    value={bottleAmount}
                    onChange={(e) => setBottleAmount(Number(e.target.value))}
                    className="w-full h-full bg-transparent border-none text-center text-4xl font-bold text-slate-900 dark:text-white focus:ring-0 p-0 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:m-0"
                    style={{ MozAppearance: 'textfield' }}
                  />
                </div>
                <button onClick={() => setBottleAmount(p => p + 10)} className="h-12 w-12 rounded-xl bg-surface-light border border-gray-200 dark:border-gray-700 dark:bg-surface-dark flex items-center justify-center text-slate-900 dark:text-white text-2xl">+</button>
              </div>
            </div>
          </div>
        </Modal>
      )}

    </div>
  );
});

export default StatsView;