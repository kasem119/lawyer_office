import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { getServerUrl } from '../api/client';

const ConnectionContext = createContext();

export function ConnectionProvider({ children }) {
  const [isConnected, setIsConnected] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [countdown, setCountdown] = useState(5);
  const isCheckingRef = useRef(false);

  const checkConnection = useCallback(async () => {
    if (isCheckingRef.current) return;
    isCheckingRef.current = true;
    setIsChecking(true);

    try {
      const res = await fetch(`${getServerUrl()}/api/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(3000)
      });
      if (res.ok) {
        setIsConnected((prev) => {
          if (!prev) {
            window.dispatchEvent(new CustomEvent('server-reconnected'));
          }
          return true;
        });
        setCountdown(10);
      } else {
        setIsConnected(false);
        setCountdown(5);
      }
    } catch {
      setIsConnected(false);
      setCountdown(5);
    } finally {
      setIsChecking(false);
      isCheckingRef.current = false;
    }
  }, []);

  // Listen to window offline / online and server network drop events
  useEffect(() => {
    const handleOnline = () => checkConnection();
    const handleOffline = () => setIsConnected(false);
    const handleServerDrop = () => {
      setIsConnected(false);
      setCountdown(5);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('server-disconnected', handleServerDrop);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('server-disconnected', handleServerDrop);
    };
  }, [checkConnection]);

  // Periodic check & countdown
  useEffect(() => {
    checkConnection();

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          checkConnection();
          return isConnected ? 15 : 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isConnected, checkConnection]);

  return (
    <ConnectionContext.Provider value={{
      isConnected,
      isChecking,
      countdown,
      checkConnection,
      serverUrl: getServerUrl()
    }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection() {
  return useContext(ConnectionContext);
}

