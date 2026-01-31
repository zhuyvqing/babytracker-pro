import { supabase, isSupabaseConfigured } from '../supabase';
import { FeedRecord, RecordType } from '../types';

// 获取当前用户 ID
async function getCurrentUserId(): Promise<string | null> {
    if (!supabase) return null;
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id || null;
}

// ============================================
// Types for Database
// ============================================

export interface GrowthLog {
    id: string;
    type: 'weight' | 'height' | 'head';
    value: number;
    date: string;
}

export interface ReminderItem {
    id: string;
    title: string;
    timeLabel: string;
    status: 'pending' | 'completed';
    description: string;
    type: 'feed' | 'diaper';
    scheduledTime?: string;
}

export interface BabyProfile {
    id?: string;
    userId?: string;
    name: string;
    birthDate: string;
}

// ============================================
// Local Storage Fallback (when Supabase not configured)
// ============================================

const STORAGE_KEYS = {
    FEED_RECORDS: 'babytracker_feed_records',
    GROWTH_LOGS: 'babytracker_growth_logs',
    REMINDERS: 'babytracker_reminders',
    BABY_PROFILE: 'babytracker_baby_profile',
};

function getFromStorage<T>(key: string, defaultValue: T): T {
    try {
        const stored = localStorage.getItem(key);
        return stored ? JSON.parse(stored) : defaultValue;
    } catch {
        return defaultValue;
    }
}

function saveToStorage<T>(key: string, data: T): void {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.error('Failed to save to localStorage:', e);
    }
}

// ============================================
// Feed Records Service
// ============================================

// Convert from database format to app format
function dbToFeedRecord(row: any): FeedRecord {
    return {
        id: row.id,
        type: row.type as RecordType,
        startTime: row.start_time,
        date: row.date || '今天',
        note: row.note,
        side: row.side,
        durationMinutes: row.duration_minutes,
        durationSeconds: row.duration_seconds,
        amountMl: row.amount_ml,
        isSnack: row.is_snack,
        diaperType: row.diaper_type,
        diaperAmount: row.diaper_amount,
        endTime: row.end_time,
    };
}

// Convert from app format to database format
function feedRecordToDb(record: FeedRecord): any {
    return {
        id: record.id,
        type: record.type,
        start_time: record.startTime,
        date: record.date,
        note: record.note,
        side: record.side,
        duration_minutes: record.durationMinutes,
        duration_seconds: record.durationSeconds,
        amount_ml: record.amountMl,
        is_snack: record.isSnack,
        diaper_type: record.diaperType,
        diaper_amount: record.diaperAmount,
        end_time: record.endTime,
    };
}

export async function getFeedRecords(): Promise<FeedRecord[]> {
    if (!isSupabaseConfigured()) {
        return getFromStorage<FeedRecord[]>(STORAGE_KEYS.FEED_RECORDS, []);
    }

    const { data, error } = await supabase!
        .from('feed_records')
        .select('*')
        .order('start_time', { ascending: false });

    if (error) {
        console.error('Error fetching feed records:', error);
        return getFromStorage<FeedRecord[]>(STORAGE_KEYS.FEED_RECORDS, []);
    }

    return (data || []).map(dbToFeedRecord);
}

export async function createFeedRecord(record: FeedRecord): Promise<FeedRecord | null> {
    if (!isSupabaseConfigured()) {
        const records = getFromStorage<FeedRecord[]>(STORAGE_KEYS.FEED_RECORDS, []);
        records.unshift(record);
        saveToStorage(STORAGE_KEYS.FEED_RECORDS, records);
        return record;
    }

    const dbRecord = feedRecordToDb(record);
    // Remove the id to let Supabase generate UUID
    delete dbRecord.id;

    // 添加当前用户 ID
    const userId = await getCurrentUserId();
    if (userId) {
        dbRecord.user_id = userId;
    }

    const { data, error } = await supabase!
        .from('feed_records')
        .insert(dbRecord)
        .select()
        .single();

    if (error) {
        console.error('Error creating feed record:', error);
        return null;
    }

    return dbToFeedRecord(data);
}

export async function updateFeedRecord(id: string, record: FeedRecord): Promise<FeedRecord | null> {
    if (!isSupabaseConfigured()) {
        const records = getFromStorage<FeedRecord[]>(STORAGE_KEYS.FEED_RECORDS, []);
        const index = records.findIndex(r => r.id === id);
        if (index !== -1) {
            records[index] = record;
            saveToStorage(STORAGE_KEYS.FEED_RECORDS, records);
        }
        return record;
    }

    const dbRecord = feedRecordToDb(record);
    delete dbRecord.id; // Don't update the id

    const { data, error } = await supabase!
        .from('feed_records')
        .update(dbRecord)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating feed record:', error);
        return null;
    }

    return dbToFeedRecord(data);
}

export async function deleteFeedRecord(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
        const records = getFromStorage<FeedRecord[]>(STORAGE_KEYS.FEED_RECORDS, []);
        const filtered = records.filter(r => r.id !== id);
        saveToStorage(STORAGE_KEYS.FEED_RECORDS, filtered);
        return true;
    }

    const { error } = await supabase!
        .from('feed_records')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting feed record:', error);
        return false;
    }

    return true;
}

// ============================================
// Growth Logs Service
// ============================================

function dbToGrowthLog(row: any): GrowthLog {
    return {
        id: row.id,
        type: row.type,
        value: parseFloat(row.value),
        date: row.date,
    };
}

export async function getGrowthLogs(): Promise<GrowthLog[]> {
    if (!isSupabaseConfigured()) {
        return getFromStorage<GrowthLog[]>(STORAGE_KEYS.GROWTH_LOGS, []);
    }

    const { data, error } = await supabase!
        .from('growth_logs')
        .select('*')
        .order('date', { ascending: false });

    if (error) {
        console.error('Error fetching growth logs:', error);
        return getFromStorage<GrowthLog[]>(STORAGE_KEYS.GROWTH_LOGS, []);
    }

    return (data || []).map(dbToGrowthLog);
}

export async function createGrowthLog(log: Omit<GrowthLog, 'id'>): Promise<GrowthLog | null> {
    if (!isSupabaseConfigured()) {
        const logs = getFromStorage<GrowthLog[]>(STORAGE_KEYS.GROWTH_LOGS, []);
        const newLog = { ...log, id: Date.now().toString() };
        logs.unshift(newLog);
        saveToStorage(STORAGE_KEYS.GROWTH_LOGS, logs);
        return newLog;
    }

    // 添加当前用户 ID
    const userId = await getCurrentUserId();

    const { data, error } = await supabase!
        .from('growth_logs')
        .insert({
            type: log.type,
            value: log.value,
            date: log.date,
            user_id: userId,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating growth log:', error);
        return null;
    }

    return dbToGrowthLog(data);
}

// ============================================
// Reminders Service
// ============================================

function dbToReminder(row: any): ReminderItem {
    return {
        id: row.id,
        title: row.title,
        timeLabel: row.time_label,
        status: row.status,
        description: row.description,
        type: row.type,
        scheduledTime: row.scheduled_time,
    };
}

export async function getReminders(): Promise<ReminderItem[]> {
    if (!isSupabaseConfigured()) {
        return getFromStorage<ReminderItem[]>(STORAGE_KEYS.REMINDERS, []);
    }

    const { data, error } = await supabase!
        .from('reminders')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching reminders:', error);
        return getFromStorage<ReminderItem[]>(STORAGE_KEYS.REMINDERS, []);
    }

    return (data || []).map(dbToReminder);
}

export async function createReminder(reminder: Omit<ReminderItem, 'id'>): Promise<ReminderItem | null> {
    if (!isSupabaseConfigured()) {
        const reminders = getFromStorage<ReminderItem[]>(STORAGE_KEYS.REMINDERS, []);
        const newReminder = { ...reminder, id: Date.now().toString() };
        reminders.unshift(newReminder);
        saveToStorage(STORAGE_KEYS.REMINDERS, reminders);
        return newReminder;
    }

    // 添加当前用户 ID
    const userId = await getCurrentUserId();

    const { data, error } = await supabase!
        .from('reminders')
        .insert({
            title: reminder.title,
            time_label: reminder.timeLabel,
            status: reminder.status,
            description: reminder.description,
            type: reminder.type,
            scheduled_time: reminder.scheduledTime,
            user_id: userId,
        })
        .select()
        .single();

    if (error) {
        console.error('Error creating reminder:', error);
        return null;
    }

    return dbToReminder(data);
}

export async function updateReminderStatus(id: string, status: 'pending' | 'completed'): Promise<boolean> {
    if (!isSupabaseConfigured()) {
        const reminders = getFromStorage<ReminderItem[]>(STORAGE_KEYS.REMINDERS, []);
        const index = reminders.findIndex(r => r.id === id);
        if (index !== -1) {
            reminders[index].status = status;
            saveToStorage(STORAGE_KEYS.REMINDERS, reminders);
        }
        return true;
    }

    const { error } = await supabase!
        .from('reminders')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);

    if (error) {
        console.error('Error updating reminder status:', error);
        return false;
    }

    return true;
}

export async function deleteReminder(id: string): Promise<boolean> {
    if (!isSupabaseConfigured()) {
        const reminders = getFromStorage<ReminderItem[]>(STORAGE_KEYS.REMINDERS, []);
        const filtered = reminders.filter(r => r.id !== id);
        saveToStorage(STORAGE_KEYS.REMINDERS, filtered);
        return true;
    }

    const { error } = await supabase!
        .from('reminders')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting reminder:', error);
        return false;
    }

    return true;
}

// ============================================
// Baby Profile Service
// ============================================

export async function getBabyProfile(): Promise<BabyProfile | null> {
    if (!isSupabaseConfigured()) {
        return getFromStorage<BabyProfile | null>(STORAGE_KEYS.BABY_PROFILE, null);
    }

    const userId = await getCurrentUserId();
    if (!userId) return null;

    const { data, error } = await supabase!
        .from('baby_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        // No profile found is not an error
        if (error.code === 'PGRST116') return null;
        console.error('Error fetching baby profile:', error);
        return getFromStorage<BabyProfile | null>(STORAGE_KEYS.BABY_PROFILE, null);
    }

    return {
        id: data.id,
        userId: data.user_id,
        name: data.name,
        birthDate: data.birth_date,
    };
}

export async function saveBabyProfile(profile: { name: string; birthDate: string }): Promise<BabyProfile | null> {
    if (!isSupabaseConfigured()) {
        const savedProfile = { ...profile, id: 'local' };
        saveToStorage(STORAGE_KEYS.BABY_PROFILE, savedProfile);
        return savedProfile;
    }

    const userId = await getCurrentUserId();
    if (!userId) return null;

    // Check if profile exists
    const existing = await getBabyProfile();

    if (existing?.id) {
        // Update
        const { data, error } = await supabase!
            .from('baby_profiles')
            .update({
                name: profile.name,
                birth_date: profile.birthDate,
            })
            .eq('id', existing.id)
            .select()
            .single();

        if (error) {
            console.error('Error updating baby profile:', error);
            return null;
        }

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            birthDate: data.birth_date,
        };
    } else {
        // Insert
        const { data, error } = await supabase!
            .from('baby_profiles')
            .insert({
                user_id: userId,
                name: profile.name,
                birth_date: profile.birthDate,
            })
            .select()
            .single();

        if (error) {
            console.error('Error creating baby profile:', error);
            return null;
        }

        return {
            id: data.id,
            userId: data.user_id,
            name: data.name,
            birthDate: data.birth_date,
        };
    }
}
