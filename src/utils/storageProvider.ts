import { User, TimeEntry, ChangeRequest, Notification } from '../types';
import * as localStorage from './storage';
import * as supabaseStorage from './supabaseStorage';

// Prüfen ob Supabase konfiguriert ist
const useSupabase = process.env.REACT_APP_SUPABASE_URL && process.env.REACT_APP_SUPABASE_ANON_KEY;

// Wrapper-Funktionen die automatisch den richtigen Storage nutzen
export const initializeUsers = async () => {
  if (!useSupabase) {
    localStorage.initializeUsers();
  }
  // Bei Supabase werden die Users durch das SQL-Script initialisiert
};

export const getUsers = async (): Promise<User[]> => {
  if (useSupabase) {
    return await supabaseStorage.getUsers();
  }
  return localStorage.getUsers();
};

export const getUserByName = async (name: string): Promise<User | null> => {
  if (useSupabase) {
    return await supabaseStorage.getUserByName(name);
  }
  return localStorage.getUserByName(name);
};

export const authenticateUser = async (name: string, pin: string): Promise<User | null> => {
  if (useSupabase) {
    return await supabaseStorage.authenticateUser(name, pin);
  }
  return localStorage.authenticateUser(name, pin);
};

export const updateUser = async (user: User): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.updateUser(user);
  }
  localStorage.updateUser(user);
};

export const getTimeEntries = async (): Promise<TimeEntry[]> => {
  if (useSupabase) {
    return await supabaseStorage.getTimeEntries();
  }
  return localStorage.getTimeEntries();
};

export const getUserTimeEntries = async (userId: string): Promise<TimeEntry[]> => {
  if (useSupabase) {
    return await supabaseStorage.getUserTimeEntries(userId);
  }
  return localStorage.getUserTimeEntries(userId);
};

export const getTodayEntry = async (userId: string): Promise<TimeEntry | null> => {
  if (useSupabase) {
    return await supabaseStorage.getTodayEntry(userId);
  }
  return localStorage.getTodayEntry(userId);
};

export const saveTimeEntry = async (entry: TimeEntry): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.saveTimeEntry(entry);
  }
  localStorage.saveTimeEntry(entry);
};

export const clockOut = async (userId: string): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.clockOut(userId);
  }
  // Für localStorage: Hole den heutigen Eintrag und setze die Endzeit
  const entries = localStorage.getTimeEntries();
  const today = new Date().toISOString().split('T')[0];
  const todayEntry = entries.find(e => e.userId === userId && e.date === today && !e.endTime);
  
  if (todayEntry) {
    todayEntry.endTime = new Date().toISOString();
    localStorage.saveTimeEntry(todayEntry);
  }
};

// Änderungsanträge-Funktionen
export const createChangeRequest = async (request: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.createChangeRequest(request);
  }
  throw new Error('Change requests require Supabase');
};

export const getChangeRequests = async (userId?: string): Promise<ChangeRequest[]> => {
  if (useSupabase) {
    return await supabaseStorage.getChangeRequests(userId);
  }
  return [];
};

export const processChangeRequest = async (
  requestId: string,
  status: 'approved' | 'rejected' | 'modified',
  adminId: string,
  adminComment?: string,
  finalValues?: {
    startTime?: string;
    endTime?: string;
    reason?: string;
  }
): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.processChangeRequest(requestId, status, adminId, adminComment, finalValues);
  }
  throw new Error('Change requests require Supabase');
};

export const directUpdateTimeEntry = async (
  entryId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    date?: string;
  }
): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.directUpdateTimeEntry(entryId, updates);
  }
  throw new Error('Direct updates require Supabase');
};

export const directUpdateBreak = async (
  breakId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    reason?: string;
  }
): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.directUpdateBreak(breakId, updates);
  }
  throw new Error('Direct updates require Supabase');
};

// Notification functions
export const createNotification = async (
  userId: string,
  message: string,
  type: 'auto_clock_out' | 'general' = 'general',
  relatedEmployeeId?: string,
  relatedEmployeeName?: string
): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.createNotification(userId, message, type, relatedEmployeeId, relatedEmployeeName);
  }
  // Für localStorage wird keine Benachrichtigung gespeichert
  console.log('Notification (localStorage only):', { userId, message, type });
};

export const saveNotification = async (notification: Notification): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.saveNotification(notification);
  }
  // Local storage implementation
  const notifications = JSON.parse(window.localStorage.getItem('notifications') || '[]');
  notifications.push(notification);
  window.localStorage.setItem('notifications', JSON.stringify(notifications));
};

export const getNotifications = async (userId: string): Promise<Notification[]> => {
  if (useSupabase) {
    return await supabaseStorage.getNotifications(userId);
  }
  // Local storage implementation
  const notifications = JSON.parse(window.localStorage.getItem('notifications') || '[]');
  return notifications.filter((n: Notification) => n.userId === userId);
};

export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  if (useSupabase) {
    return await supabaseStorage.markNotificationAsRead(notificationId);
  }
  // Local storage implementation
  const notifications = JSON.parse(window.localStorage.getItem('notifications') || '[]');
  const index = notifications.findIndex((n: Notification) => n.id === notificationId);
  if (index !== -1) {
    notifications[index].read = true;
    window.localStorage.setItem('notifications', JSON.stringify(notifications));
  }
};