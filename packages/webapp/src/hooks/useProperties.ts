import { useState, useEffect, useCallback } from 'react';
import { Property } from '../types';
import { api } from '../lib/api';

export const useProperties = () => {
  const [properties, setProperties] = useState<Property[]>([]);
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

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  return { properties, loading, error, refetch: fetchProperties };
};

export const useProperty = (id: string) => {
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProperty = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getProperty(parseInt(id));
      setProperty(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch property');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchProperty();
  }, [fetchProperty]);

  return { property, loading, error, refetch: fetchProperty };
};
