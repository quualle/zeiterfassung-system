import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL!;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users_zeiterfassung: {
        Row: {
          id: string;
          name: string;
          pin: string | null;
          role: string;
        };
        Insert: {
          id?: string;
          name: string;
          pin?: string | null;
          role: string;
        };
        Update: {
          id?: string;
          name?: string;
          pin?: string | null;
          role?: string;
        };
      };
      time_entries_zeiterfassung: {
        Row: {
          id: string;
          user_id: string;
          start_time: string;
          end_time: string | null;
          date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          start_time: string;
          end_time?: string | null;
          date: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          start_time?: string;
          end_time?: string | null;
          date?: string;
        };
      };
      breaks_zeiterfassung: {
        Row: {
          id: string;
          time_entry_id: string;
          start_time: string;
          end_time: string | null;
          reason: string;
        };
        Insert: {
          id?: string;
          time_entry_id: string;
          start_time: string;
          end_time?: string | null;
          reason: string;
        };
        Update: {
          id?: string;
          time_entry_id?: string;
          start_time?: string;
          end_time?: string | null;
          reason?: string;
        };
      };
    };
  };
};