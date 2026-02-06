import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Property, QueueStatus } from '../types';
import { api } from '../lib/api';

interface AppContextType {
  properties: Property[];
  queueStatus: QueueStatus | null;
  loading: boolean;
  error: string | null;
  fetchProperties: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch properties');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshQueueStatus = useCallback(async () => {
    try {
      setError(null);
      const status = await api.getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch queue status');
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Auto-refresh queue status every 5 seconds
  useEffect(() => {
    refreshQueueStatus();
    const interval = setInterval(refreshQueueStatus, 5000);
    return () => clearInterval(interval);
  }, [refreshQueueStatus]);

  const value = {
    properties,
    queueStatus,
    loading,
    error,
    fetchProperties,
    refreshQueueStatus,
    clearError,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
