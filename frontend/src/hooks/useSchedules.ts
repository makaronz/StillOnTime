import { useState, useEffect } from 'react';
import { Schedule, CreateScheduleRequest, UpdateScheduleRequest } from '@/types/schedule';
import { api } from '@/services/api';

interface UseSchedulesOptions {
  startDate?: Date;
  endDate?: Date;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export const useSchedules = (options: UseSchedulesOptions = {}) => {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const {
    startDate,
    endDate,
    autoRefresh = false,
    refreshInterval = 60000 // 1 minute
  } = options;

  const fetchSchedules = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate.toISOString());
      if (endDate) params.append('endDate', endDate.toISOString());

      const response = await api.get(`/api/schedules?${params}`);
      setSchedules(response.data);
      setLastUpdated(new Date());
    } catch (err: any) {
      setError(err.message || 'Failed to fetch schedules');
      console.error('Failed to fetch schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  const createSchedule = async (data: CreateScheduleRequest): Promise<Schedule> => {
    try {
      const response = await api.post('/api/schedules', data);
      const newSchedule = response.data;
      setSchedules(prev => [...prev, newSchedule]);
      return newSchedule;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to create schedule');
    }
  };

  const updateSchedule = async (id: string, data: UpdateScheduleRequest): Promise<Schedule> => {
    try {
      const response = await api.put(`/api/schedules/${id}`, data);
      const updatedSchedule = response.data;
      setSchedules(prev =>
        prev.map(s => s.id === id ? updatedSchedule : s)
      );
      return updatedSchedule;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to update schedule');
    }
  };

  const deleteSchedule = async (id: string): Promise<void> => {
    try {
      await api.delete(`/api/schedules/${id}`);
      setSchedules(prev => prev.filter(s => s.id !== id));
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to delete schedule');
    }
  };

  const getSchedule = async (id: string): Promise<Schedule> => {
    try {
      const response = await api.get(`/api/schedules/${id}`);
      return response.data;
    } catch (err: any) {
      throw new Error(err.response?.data?.message || 'Failed to fetch schedule');
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchSchedules();
  }, [startDate, endDate]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchSchedules, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, startDate, endDate]);

  return {
    schedules,
    loading,
    error,
    lastUpdated,
    refresh: fetchSchedules,
    create: createSchedule,
    update: updateSchedule,
    delete: deleteSchedule,
    get: getSchedule
  };
};