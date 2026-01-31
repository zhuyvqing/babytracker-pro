
export type RecordType = 'breast' | 'bottle' | 'diaper' | 'sleep' | 'pump';

export interface FeedRecord {
  id: string;
  type: RecordType;
  // Common
  startTime: string; // ISO string
  date: string;      // Display string like "今天"
  note?: string;

  // Breast/Bottle
  side?: 'left' | 'right';
  durationMinutes?: number;
  durationSeconds?: number; // Precise duration in seconds
  amountMl?: number;
  isSnack?: boolean; // New field for bottle feeding stats exclusion

  // Diaper
  diaperType?: 'wet' | 'dirty' | 'mixed';
  diaperAmount?: 'small' | 'medium' | 'large';

  // Sleep
  endTime?: string; // For calculating duration if needed
}

export interface GrowthRecord {
  month: number;
  value: number;
  label: string;
  whoStandard: number; // WHO average for comparison
}

export type TabType = 'record' | 'stats' | 'reminders';
