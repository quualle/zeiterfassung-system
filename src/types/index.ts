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
  id?: string;
  startTime: string;
  endTime?: string;
  reason: string;
}

export interface ChangeRequest {
  id: string;
  userId: string;
  timeEntryId: string;
  requestType: 'time_entry' | 'break';
  breakId?: string;
  
  // Aktuelle Werte
  currentStartTime?: string;
  currentEndTime?: string;
  currentReason?: string;
  
  // Gewünschte neue Werte
  newStartTime?: string;
  newEndTime?: string;
  newReason?: string;
  newDate?: string;
  
  // Begründung
  changeReason: string;
  
  // Status
  status: 'pending' | 'approved' | 'rejected' | 'modified';
  adminComment?: string;
  
  // Admin's finale Werte
  finalStartTime?: string;
  finalEndTime?: string;
  finalReason?: string;
  
  // Zeitstempel
  createdAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface Notification {
  id: string;
  userId: string;
  message: string;
  type: 'auto_clock_out' | 'general';
  createdAt: string;
  read: boolean;
  relatedEmployeeId?: string;
  relatedEmployeeName?: string;
}

export interface AppState {
  currentUser: User | null;
  isWorking: boolean;
  currentEntry: TimeEntry | null;
  isOnBreak: boolean;
}

export interface WorkTimeRule {
  id: string;
  user_id: string;
  earliest_login_time: string; // Time format: "HH:MM:SS"
  latest_logout_time: string; // Time format: "HH:MM:SS"
  is_active: boolean;
  created_at: string;
  updated_at: string;
}