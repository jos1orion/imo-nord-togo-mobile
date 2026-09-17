'use client';

import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabaseClient';

type TableOptions = {
  select?: string;
  orderBy?: string;
  ascending?: boolean;
  realtime?: boolean;
};

export const useSupabaseTable = <T,>(table: string, options: TableOptions = {}) => {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const query = supabase.from(table).select(options.select ?? '*');
    const { data, error } = options.orderBy
      ? await query.order(options.orderBy, { ascending: options.ascending ?? false })
      : await query;
    if (error) {
      setError(error.message);
    } else {
      setData((data as T[]) ?? []);
    }
    setLoading(false);
  }, [table, options.orderBy, options.select, options.ascending]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (options.realtime === false) return;
    let timeout: ReturnType<typeof setTimeout> | null = null;
    const scheduleReload = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        load();
      }, 300);
    };
    const channel = supabase
      .channel(`realtime-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, scheduleReload)
      .subscribe();
    return () => {
      if (timeout) clearTimeout(timeout);
      supabase.removeChannel(channel);
    };
  }, [table, load, options.realtime]);

  return { data, setData, loading, error, reload: load };
};
