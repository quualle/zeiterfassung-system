export interface User {
  id: string;
  name: string;
  pin?: string | null;
  role: 'admin' | 'employee';
  firstLogin?: boolean;
}

export interface TimeEntry {
  id: string;
  userId: string;
  startTime: string;
  endTime?: string;
  breaks: Break[];
  date: string;
}

export interface Break {
  startTime: string;
  endTime?: string;
  reason: string;
}

export interface AppState {
  currentUser: User | null;
  isWorking: boolean;
  currentEntry: TimeEntry | null;
  isOnBreak: boolean;
}