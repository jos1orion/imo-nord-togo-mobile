'use client';

import { useEffect, useState } from 'react';

const MINUTE = 60_000;

export const useCurrentTime = (refreshInterval = MINUTE) => {
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    const updateTime = () => setCurrentTime(Date.now());
    const initialUpdate = setTimeout(updateTime, 0);
    const interval = setInterval(updateTime, refreshInterval);

    return () => {
      clearTimeout(initialUpdate);
      clearInterval(interval);
    };
  }, [refreshInterval]);

  return currentTime;
};
