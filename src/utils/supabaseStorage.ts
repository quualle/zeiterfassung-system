import { User, TimeEntry } from '../types';
import { supabase } from '../lib/supabase';

// Benutzer-Funktionen
export const getUsers = async (): Promise<User[]> => {
  const { data, error } = await supabase
    .from('users_zeiterfassung')
    .select('*')
    .order('name');
  
  if (error) {
    console.error('Error fetching users:', error);
    return [];
  }
  
  return data.map(user => ({
    ...user,
    firstLogin: !user.pin
  }));
};

export const getUserByName = async (name: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users_zeiterfassung')
    .select('*')
    .eq('name', name)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return {
    ...data,
    firstLogin: !data.pin
  };
};

export const authenticateUser = async (name: string, pin: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('users_zeiterfassung')
    .select('*')
    .eq('name', name)
    .eq('pin', pin)
    .single();
  
  if (error || !data) {
    return null;
  }
  
  return data;
};

export const updateUser = async (user: User): Promise<void> => {
  const { error } = await supabase
    .from('users_zeiterfassung')
    .update({ 
      pin: user.pin,
      role: user.role 
    })
    .eq('id', user.id);
  
  if (error) {
    console.error('Error updating user:', error);
  }
};

// Zeiterfassungs-Funktionen
export const getTimeEntries = async (): Promise<TimeEntry[]> => {
  const { data: entries, error: entriesError } = await supabase
    .from('time_entries_zeiterfassung')
    .select('*')
    .order('start_time', { ascending: false });
  
  if (entriesError || !entries) {
    console.error('Error fetching time entries:', entriesError);
    return [];
  }

  // Pausen für alle Einträge holen
  const { data: breaks, error: breaksError } = await supabase
    .from('breaks_zeiterfassung')
    .select('*')
    .in('time_entry_id', entries.map(e => e.id));
  
  if (breaksError) {
    console.error('Error fetching breaks:', breaksError);
  }

  // Einträge mit Pausen zusammenführen
  return entries.map(entry => ({
    ...entry,
    userId: entry.user_id,
    startTime: entry.start_time,
    endTime: entry.end_time,
    breaks: (breaks || [])
      .filter(b => b.time_entry_id === entry.id)
      .map(b => ({
        startTime: b.start_time,
        endTime: b.end_time,
        reason: b.reason
      }))
  }));
};

export const getUserTimeEntries = async (userId: string): Promise<TimeEntry[]> => {
  const entries = await getTimeEntries();
  return entries.filter(entry => entry.userId === userId);
};

export const getTodayEntry = async (userId: string): Promise<TimeEntry | null> => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data: entries, error } = await supabase
    .from('time_entries_zeiterfassung')
    .select('*')
    .eq('user_id', userId)
    .eq('date', today)
    .filter('end_time', 'is', null);
  
  if (error || !entries || entries.length === 0) {
    return null;
  }

  const entry = entries[0];

  // Pausen holen
  const { data: breaks } = await supabase
    .from('breaks_zeiterfassung')
    .select('*')
    .eq('time_entry_id', entry.id);

  return {
    id: entry.id,
    userId: entry.user_id,
    startTime: entry.start_time,
    endTime: entry.end_time,
    date: entry.date,
    breaks: (breaks || []).map(b => ({
      startTime: b.start_time,
      endTime: b.end_time,
      reason: b.reason
    }))
  };
};

export const saveTimeEntry = async (entry: TimeEntry): Promise<void> => {
  // Prüfen ob Entry existiert
  const { data: existing } = await supabase
    .from('time_entries_zeiterfassung')
    .select('id')
    .eq('id', entry.id)
    .single();

  if (existing) {
    // Update existing entry
    const { error } = await supabase
      .from('time_entries_zeiterfassung')
      .update({
        end_time: entry.endTime,
        start_time: entry.startTime,
        date: entry.date
      })
      .eq('id', entry.id);
    
    if (error) {
      console.error('Error updating time entry:', error);
    }
  } else {
    // Create new entry
    const { error } = await supabase
      .from('time_entries_zeiterfassung')
      .insert({
        id: entry.id,
        user_id: entry.userId,
        start_time: entry.startTime,
        end_time: entry.endTime,
        date: entry.date
      });
    
    if (error) {
      console.error('Error creating time entry:', error);
    }
  }

  // Pausen verwalten
  if (entry.breaks && entry.breaks.length > 0) {
    // Alle existierenden Pausen für diesen Entry holen
    const { data: existingBreaks } = await supabase
      .from('breaks_zeiterfassung')
      .select('id')
      .eq('time_entry_id', entry.id);

    const existingBreakCount = existingBreaks?.length || 0;

    // Neue Pausen hinzufügen (die noch nicht in der DB sind)
    const newBreaks = entry.breaks.slice(existingBreakCount);
    
    if (newBreaks.length > 0) {
      const breaksToInsert = newBreaks.map(breakItem => ({
        time_entry_id: entry.id,
        start_time: breakItem.startTime,
        end_time: breakItem.endTime,
        reason: breakItem.reason
      }));

      const { error: breakError } = await supabase
        .from('breaks_zeiterfassung')
        .insert(breaksToInsert);
      
      if (breakError) {
        console.error('Error saving breaks:', breakError);
      }
    }

    // Letzte Pause updaten wenn sie beendet wurde
    if (existingBreaks && existingBreaks.length > 0) {
      const lastBreak = entry.breaks[entry.breaks.length - 1];
      if (lastBreak.endTime) {
        const { error } = await supabase
          .from('breaks_zeiterfassung')
          .update({ end_time: lastBreak.endTime })
          .eq('time_entry_id', entry.id)
          .filter('end_time', 'is', null);
        
        if (error) {
          console.error('Error updating break:', error);
        }
      }
    }
  }
};