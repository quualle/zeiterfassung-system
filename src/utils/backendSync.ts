import { supabase } from '../lib/supabase';

// Backend URL - update this after deploying to Render
const BACKEND_URL = process.env.REACT_APP_SYNC_BACKEND_URL || 'http://localhost:3001';

export async function syncWithBackend() {
  console.log('Calling backend sync service...');
  
  try {
    const response = await fetch(`${BACKEND_URL}/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend sync failed: ${response.statusText}`);
    }

    const result = await response.json();
    console.log('Backend sync result:', result);

    // Refresh local data after successful sync
    if (result.success) {
      return {
        success: true,
        message: result.message,
        details: result.details
      };
    } else {
      throw new Error(result.message || 'Sync failed');
    }
  } catch (error: any) {
    console.error('Backend sync error:', error);
    
    // If backend is not available, show helpful message
    if (error.message.includes('fetch')) {
      return {
        success: false,
        message: 'Backend-Service nicht erreichbar. Bitte README für Setup-Anleitung prüfen.',
        details: null
      };
    }
    
    throw error;
  }
}

// Health check function
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${BACKEND_URL}/health`);
    return response.ok;
  } catch {
    return false;
  }
}