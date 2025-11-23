/**
 * Utility functions for managing session IDs in local storage
 */

const SESSION_IDS_KEY = 'privy_session_ids';

export interface SessionIdData {
  address: string;
  signerId: string;
  timestamp: number;
}

/**
 * Get all stored session IDs from local storage
 */
export function getStoredSessionIds(): SessionIdData[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const stored = localStorage.getItem(SESSION_IDS_KEY);
    if (!stored) return [];
    return JSON.parse(stored) as SessionIdData[];
  } catch (error) {
    console.error('Error reading session IDs from local storage:', error);
    return [];
  }
}

/**
 * Store a session ID in local storage
 */
export function storeSessionId(address: string, signerId: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getStoredSessionIds();
    const newSession: SessionIdData = {
      address,
      signerId,
      timestamp: Date.now(),
    };
    
    // Remove any existing session for this address
    const filtered = existing.filter(s => s.address.toLowerCase() !== address.toLowerCase());
    
    // Add the new session
    const updated = [...filtered, newSession];
    localStorage.setItem(SESSION_IDS_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('Error storing session ID in local storage:', error);
  }
}

/**
 * Remove a session ID from local storage
 */
export function removeSessionId(address: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const existing = getStoredSessionIds();
    const filtered = existing.filter(s => s.address.toLowerCase() !== address.toLowerCase());
    localStorage.setItem(SESSION_IDS_KEY, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing session ID from local storage:', error);
  }
}

/**
 * Get session IDs for a specific address
 */
export function getSessionIdsForAddress(address: string): SessionIdData[] {
  const allSessions = getStoredSessionIds();
  return allSessions.filter(s => s.address.toLowerCase() === address.toLowerCase());
}

/**
 * Clear all session IDs from local storage
 */
export function clearAllSessionIds(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(SESSION_IDS_KEY);
}


