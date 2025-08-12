import { User, TimeEntry } from '../types';

const USERS_KEY = 'zeiterfassung_users';
const ENTRIES_KEY = 'zeiterfassung_entries';

export const initializeUsers = () => {
  const existingUsers = localStorage.getItem(USERS_KEY);
  if (!existingUsers) {
    const defaultUsers: User[] = [
      {
        id: '1',
        name: 'Ines Cürten',
        role: 'admin',
        firstLogin: true
      },
      {
        id: '2',
        name: 'Christiane Rohde',
        role: 'employee',
        firstLogin: true
      },
      {
        id: '3',
        name: 'Emilia Rathmann',
        role: 'employee',
        firstLogin: true
      }
    ];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
  }
};

export const getUsers = (): User[] => {
  const users = localStorage.getItem(USERS_KEY);
  return users ? JSON.parse(users) : [];
};

export const authenticateUser = (name: string, pin: string): User | null => {
  const users = getUsers();
  return users.find(user => user.name === name && user.pin === pin) || null;
};

export const getUserByName = (name: string): User | null => {
  const users = getUsers();
  return users.find(user => user.name === name) || null;
};

export const updateUser = (user: User) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === user.id);
  if (index >= 0) {
    users[index] = user;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }
};

export const saveTimeEntry = (entry: TimeEntry) => {
  const entries = getTimeEntries();
  const existingIndex = entries.findIndex(e => e.id === entry.id);
  
  if (existingIndex >= 0) {
    entries[existingIndex] = entry;
  } else {
    entries.push(entry);
  }
  
  localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
};

export const getTimeEntries = (): TimeEntry[] => {
  const entries = localStorage.getItem(ENTRIES_KEY);
  return entries ? JSON.parse(entries) : [];
};

export const getUserTimeEntries = (userId: string): TimeEntry[] => {
  return getTimeEntries().filter(entry => entry.userId === userId);
};

export const getTodayEntry = (userId: string): TimeEntry | null => {
  const today = new Date().toISOString().split('T')[0];
  const entries = getUserTimeEntries(userId);
  return entries.find(entry => entry.date === today && !entry.endTime) || null;
};