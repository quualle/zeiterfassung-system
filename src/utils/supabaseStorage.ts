import { User, TimeEntry, ChangeRequest } from '../types';
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
        id: b.id,
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
      id: b.id,
      startTime: b.start_time,
      endTime: b.end_time,
      reason: b.reason
    }))
  };
};

export const saveTimeEntry = async (entry: TimeEntry): Promise<void> => {
  // Prüfen ob Entry existiert
  const { data: existing, error: checkError } = await supabase
    .from('time_entries_zeiterfassung')
    .select('id')
    .eq('id', entry.id);

  // Entry existiert wenn kein Fehler und Daten vorhanden sind
  if (!checkError && existing && existing.length > 0) {
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
      console.error('Attempted data:', {
        id: entry.id,
        user_id: entry.userId,
        start_time: entry.startTime,
        end_time: entry.endTime,
        date: entry.date
      });
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

// Änderungsanträge-Funktionen
export const createChangeRequest = async (request: Omit<ChangeRequest, 'id' | 'createdAt' | 'status'>): Promise<void> => {
  const { error } = await supabase
    .from('change_requests_zeiterfassung')
    .insert({
      user_id: request.userId,
      time_entry_id: request.timeEntryId,
      request_type: request.requestType,
      break_id: request.breakId,
      current_start_time: request.currentStartTime,
      current_end_time: request.currentEndTime,
      current_reason: request.currentReason,
      new_start_time: request.newStartTime,
      new_end_time: request.newEndTime,
      new_reason: request.newReason,
      change_reason: request.changeReason
    });
    
  if (error) {
    console.error('Error creating change request:', error);
    throw error;
  }
};

export const getChangeRequests = async (userId?: string): Promise<ChangeRequest[]> => {
  let query = supabase
    .from('change_requests_zeiterfassung')
    .select('*')
    .order('created_at', { ascending: false });
    
  if (userId) {
    query = query.eq('user_id', userId);
  }
  
  const { data, error } = await query;
  
  if (error || !data) {
    console.error('Error fetching change requests:', error);
    return [];
  }
  
  return data.map(req => ({
    id: req.id,
    userId: req.user_id,
    timeEntryId: req.time_entry_id,
    requestType: req.request_type,
    breakId: req.break_id,
    currentStartTime: req.current_start_time,
    currentEndTime: req.current_end_time,
    currentReason: req.current_reason,
    newStartTime: req.new_start_time,
    newEndTime: req.new_end_time,
    newReason: req.new_reason,
    changeReason: req.change_reason,
    status: req.status,
    adminComment: req.admin_comment,
    finalStartTime: req.final_start_time,
    finalEndTime: req.final_end_time,
    finalReason: req.final_reason,
    createdAt: req.created_at,
    processedAt: req.processed_at,
    processedBy: req.processed_by
  }));
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
  const updateData: any = {
    status,
    processed_at: new Date().toISOString(),
    processed_by: adminId,
    admin_comment: adminComment
  };
  
  if (finalValues) {
    updateData.final_start_time = finalValues.startTime;
    updateData.final_end_time = finalValues.endTime;
    updateData.final_reason = finalValues.reason;
  }
  
  const { error } = await supabase
    .from('change_requests_zeiterfassung')
    .update(updateData)
    .eq('id', requestId);
    
  if (error) {
    console.error('Error processing change request:', error);
    throw error;
  }
  
  // Wenn genehmigt oder modifiziert, die eigentlichen Daten aktualisieren
  if (status === 'approved' || status === 'modified') {
    const { data: request } = await supabase
      .from('change_requests_zeiterfassung')
      .select('*')
      .eq('id', requestId)
      .single();
      
    if (request) {
      if (request.request_type === 'time_entry') {
        const { error: updateError } = await supabase
          .from('time_entries_zeiterfassung')
          .update({
            start_time: finalValues?.startTime || request.new_start_time,
            end_time: finalValues?.endTime || request.new_end_time
          })
          .eq('id', request.time_entry_id);
          
        if (updateError) {
          console.error('Error updating time entry:', updateError);
        }
      } else if (request.request_type === 'break' && request.break_id) {
        const { error: updateError } = await supabase
          .from('breaks_zeiterfassung')
          .update({
            start_time: finalValues?.startTime || request.new_start_time,
            end_time: finalValues?.endTime || request.new_end_time,
            reason: finalValues?.reason || request.new_reason
          })
          .eq('id', request.break_id);
          
        if (updateError) {
          console.error('Error updating break:', updateError);
        }
      }
    }
  }
};

// Direkte Editierfunktion für Admin
export const directUpdateTimeEntry = async (
  entryId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    date?: string;
  }
): Promise<void> => {
  const updateData: any = {};
  if (updates.startTime) updateData.start_time = updates.startTime;
  if (updates.endTime) updateData.end_time = updates.endTime;
  if (updates.date) updateData.date = updates.date;
  
  const { error } = await supabase
    .from('time_entries_zeiterfassung')
    .update(updateData)
    .eq('id', entryId);
    
  if (error) {
    console.error('Error updating time entry:', error);
    throw error;
  }
};

export const directUpdateBreak = async (
  breakId: string,
  updates: {
    startTime?: string;
    endTime?: string;
    reason?: string;
  }
): Promise<void> => {
  const updateData: any = {};
  if (updates.startTime) updateData.start_time = updates.startTime;
  if (updates.endTime) updateData.end_time = updates.endTime;
  if (updates.reason) updateData.reason = updates.reason;
  
  const { error } = await supabase
    .from('breaks_zeiterfassung')
    .update(updateData)
    .eq('id', breakId);
    
  if (error) {
    console.error('Error updating break:', error);
    throw error;
  }
};