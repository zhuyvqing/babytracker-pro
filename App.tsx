import React, { createContext, useContext, useState, useEffect, startTransition, useCallback, memo } from 'react';
import { HashRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import HomeView from './views/HomeView';
import GrowthView from './views/GrowthView';
import StatsView from './views/StatsView';
import RemindersView from './views/RemindersView';
import LoginModal from './views/LoginModal';
import { AuthProvider, useAuth } from './AuthContext';
import { BabyProvider } from './BabyContext';
import { TimerProvider } from './TimerContext';
import { FeedRecord } from './types';
import { getFeedRecords, createFeedRecord, updateFeedRecord as updateFeedRecordDb, deleteFeedRecord as deleteFeedRecordDb } from './services/database';

// --- Context Setup ---
interface RecordsContextType {
  records: FeedRecord[];
  addRecord: (record: FeedRecord) => void;
  updateRecord: (id: string, record: FeedRecord) => void;
  deleteRecord: (id: string) => void;
  isLoading: boolean;
}

const RecordsContext = createContext<RecordsContextType | undefined>(undefined);

export const useRecords = () => {
  const context = useContext(RecordsContext);
  if (!context) throw new Error('useRecords must be used within a RecordsProvider');
  return context;
};

export const RecordsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [records, setRecords] = useState<FeedRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load records from database when user changes
  useEffect(() => {
    const loadRecords = async () => {
      // Clear records first when user changes
      setRecords([]);
      setIsLoading(true);

      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        const data = await getFeedRecords();
        if (data.length > 0) {
          setRecords(data);
        }
        // 数据库为空时保持空数组，不初始化静态数据
      } catch (error) {
        console.error('Failed to load records:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadRecords();
  }, [user]); // Re-run when user changes

  const addRecord = async (record: FeedRecord) => {
    // Optimistically update UI
    setRecords(prev => [record, ...prev]);
    // Persist to database
    const saved = await createFeedRecord(record);
    if (saved && saved.id !== record.id) {
      // Update with the real ID from database
      setRecords(prev => prev.map(r => r.id === record.id ? saved : r));
    }
  };

  const updateRecord = async (id: string, updatedRecord: FeedRecord) => {
    // Optimistically update UI
    setRecords(prev => prev.map(record => record.id === id ? updatedRecord : record));
    // Persist to database
    await updateFeedRecordDb(id, updatedRecord);
  };

  const deleteRecord = async (id: string) => {
    // Optimistically remove from UI
    setRecords(prev => prev.filter(record => record.id !== id));
    // Delete from database
    await deleteFeedRecordDb(id);
  };

  return (
    <RecordsContext.Provider value={{ records, addRecord, updateRecord, deleteRecord, isLoading }}>
      {children}
    </RecordsContext.Provider>
  );
};


const BottomNav: React.FC = memo(() => {
  const location = useLocation();
  const navigate = useNavigate();
  const isActive = (path: string) => location.pathname === path;

  const handleNavigation = useCallback((path: string) => {
    if (location.pathname === path) return; // 避免重复导航
    startTransition(() => {
      navigate(path);
    });
  }, [navigate, location.pathname]);

  return (
    <nav className="fixed bottom-0 left-0 w-full bg-surface-light/90 dark:bg-[#102216]/95 backdrop-blur-lg border-t border-gray-200 dark:border-gray-800 z-50 pb-[env(safe-area-inset-bottom,20px)] pt-2">
      <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto">
        <button
          onClick={() => handleNavigation('/')}
          className={`flex flex-col items-center gap-1 p-2 w-20 rounded-xl transition-all ${isActive('/') ? 'text-primary' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <span className={`material-symbols-outlined text-[26px] ${isActive('/') ? 'fill' : ''}`}>dashboard</span>
          <span className="text-[10px] font-bold tracking-wide">记录</span>
        </button>
        <button
          onClick={() => handleNavigation('/stats')}
          className={`flex flex-col items-center gap-1 p-2 w-20 rounded-xl transition-all ${isActive('/stats') ? 'text-primary' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <span className={`material-symbols-outlined text-[26px] ${isActive('/stats') ? 'fill' : ''}`}>bar_chart</span>
          <span className="text-[10px] font-medium tracking-wide">统计</span>
        </button>
        <button
          onClick={() => handleNavigation('/reminders')}
          className={`flex flex-col items-center gap-1 p-2 w-20 rounded-xl transition-all ${isActive('/reminders') ? 'text-primary' : 'text-gray-400 hover:text-gray-200'}`}
        >
          <span className={`material-symbols-outlined text-[26px] ${isActive('/reminders') ? 'fill' : ''}`}>notifications</span>
          <span className="text-[10px] font-medium tracking-wide">提醒</span>
        </button>
      </div>
    </nav>
  );
});

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  // Growth view is a sub-page, so it doesn't show the bottom nav
  const showBottomNav = ['/', '/stats', '/reminders'].includes(location.pathname);

  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display flex justify-center">
      <div className="w-full max-w-md relative flex flex-col min-h-screen shadow-2xl overflow-hidden bg-background-light dark:bg-background-dark">
        <div className="flex-1 overflow-y-auto no-scrollbar pb-24">
          {children}
        </div>
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
};

// Login Modal Wrapper
const LoginModalWrapper: React.FC = () => {
  const { showLoginModal, setShowLoginModal } = useAuth();
  return <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />;
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <BabyProvider>
        <RecordsProvider>
          <TimerProvider>
            <HashRouter>
              <Layout>
                <Routes>
                  <Route path="/" element={<HomeView />} />
                  <Route path="/growth" element={<GrowthView />} />
                  <Route path="/stats" element={<StatsView />} />
                  <Route path="/reminders" element={<RemindersView />} />
                </Routes>
              </Layout>
              <LoginModalWrapper />
            </HashRouter>
          </TimerProvider>
        </RecordsProvider>
      </BabyProvider>
    </AuthProvider>
  );
};

export default App;