import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface TimerContextType {
  isRunning: boolean;
  elapsedSeconds: number;
  selectedSide: 'left' | 'right';
  startTimer: () => void;
  pauseTimer: () => void;
  resetTimer: () => void;
  setSelectedSide: (side: 'left' | 'right') => void;
}

const TimerContext = createContext<TimerContextType | undefined>(undefined);

export const useTimer = () => {
  const context = useContext(TimerContext);
  if (!context) throw new Error('useTimer must be used within a TimerProvider');
  return context;
};

export const TimerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Core timer state
  const [isRunning, setIsRunning] = useState(false);
  const [startTimestamp, setStartTimestamp] = useState<number | null>(null);
  const [pausedSeconds, setPausedSeconds] = useState(0);
  const [selectedSide, setSelectedSide] = useState<'left' | 'right'>('left');
  
  // Trigger re-render for elapsed time calculation
  const [renderTrigger, setRenderTrigger] = useState(0);

  // Calculate elapsed seconds based on timestamp (not setInterval accumulation)
  const getElapsedSeconds = useCallback(() => {
    if (!isRunning || startTimestamp === null) {
      return pausedSeconds;
    }
    return pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000);
  }, [isRunning, startTimestamp, pausedSeconds]);

  // Update display every second when running
  useEffect(() => {
    let interval: number | undefined;
    if (isRunning) {
      interval = window.setInterval(() => {
        setRenderTrigger(prev => prev + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Handle visibility change (screen on/off, tab switch)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Force re-render to update displayed time with correct elapsed seconds
        setRenderTrigger(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const startTimer = useCallback(() => {
    if (!isRunning) {
      setStartTimestamp(Date.now());
      setIsRunning(true);
    }
  }, [isRunning]);

  const pauseTimer = useCallback(() => {
    if (isRunning && startTimestamp !== null) {
      // Save accumulated time before pausing
      const currentElapsed = pausedSeconds + Math.floor((Date.now() - startTimestamp) / 1000);
      setPausedSeconds(currentElapsed);
      setStartTimestamp(null);
      setIsRunning(false);
    }
  }, [isRunning, startTimestamp, pausedSeconds]);

  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setStartTimestamp(null);
    setPausedSeconds(0);
  }, []);

  const handleSetSelectedSide = useCallback((side: 'left' | 'right') => {
    setSelectedSide(side);
  }, []);

  // Calculate current elapsed seconds for display
  const elapsedSeconds = getElapsedSeconds();

  return (
    <TimerContext.Provider
      value={{
        isRunning,
        elapsedSeconds,
        selectedSide,
        startTimer,
        pauseTimer,
        resetTimer,
        setSelectedSide: handleSetSelectedSide,
      }}
    >
      {children}
    </TimerContext.Provider>
  );
};
