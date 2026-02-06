import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Property, QueueStatus } from '../types';
import { api } from '../lib/api';

interface AppContextType {
  properties: Property[];
  queueStatus: QueueStatus | null;
  loading: boolean;
  errors: {
    properties: string | null;
    queueStatus: string | null;
  };
  selectedProperties: Property[];
  setSelectedProperties: React.Dispatch<React.SetStateAction<Property[]>>;
  fetchProperties: () => Promise<void>;
  refreshQueueStatus: () => Promise<void>;
  clearError: (key: keyof AppContextType['errors']) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [queueStatus, setQueueStatus] = useState<QueueStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({
    properties: null,
    queueStatus: null,
  });
  const [selectedProperties, setSelectedProperties] = useState<Property[]>([]);

  const fetchProperties = useCallback(async () => {
    try {
      setLoading(true);
      setErrors((prev) => ({ ...prev, properties: null }));
      const data = await api.getProperties();
      setProperties(data);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        properties: err instanceof Error ? err.message : 'Failed to fetch properties',
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshQueueStatus = useCallback(async () => {
    try {
      setErrors((prev) => ({ ...prev, queueStatus: null }));
      const status = await api.getQueueStatus();
      setQueueStatus(status);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        queueStatus: err instanceof Error ? err.message : 'Failed to fetch queue status',
      }));
    }
  }, []);

  const clearError = useCallback((key: keyof AppContextType['errors']) => {
    setErrors((prev) => ({ ...prev, [key]: null }));
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
    errors,
    selectedProperties,
    setSelectedProperties,
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
