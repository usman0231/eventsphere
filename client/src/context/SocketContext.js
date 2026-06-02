import React, { createContext, useContext, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { useAuth } from './AuthContext';

const TOAST_ICON = {
  booth_approved: '🎉',
  booth_rejected: '❌',
  message: '✉️',
  session_reminder: '⏰',
  expo_update: '📢',
  application_received: '📋',
  announcement: '📣',
  welcome: '👋',
};

const SocketContext = createContext({
  socket: null,
  notifications: [],
  setNotifications: () => {},
  unreadCount: 0,
  setUnreadCount: () => {},
  markAllRead: () => {},
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    let newSocket = null;

    const connectSocket = async () => {
      try {
        const { io } = await import('socket.io-client');
        // undefined → connect to same origin (production, served by Express); localhost in dev.
        const socketUrl = process.env.REACT_APP_API_URL || (process.env.NODE_ENV === 'production' ? undefined : 'http://localhost:5000');
        newSocket = io(socketUrl, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 3,
        });

        newSocket.on('connect', () => {
          console.log('🔌 Socket connected');
          newSocket.emit('join', user._id);
        });

        newSocket.on('notification', (notif) => {
          setNotifications(prev => [notif, ...prev]);
          setUnreadCount(prev => prev + 1);
          const icon = TOAST_ICON[notif.type] || '🔔';
          toast(
            <div style={{ lineHeight: 1.35 }}>
              <div style={{ fontWeight: 700, marginBottom: 2 }}>{icon} {notif.title}</div>
              <div style={{ fontSize: '0.85rem', opacity: 0.85 }}>{notif.message}</div>
            </div>,
            { autoClose: 5000 }
          );
        });

        newSocket.on('connect_error', (err) => {
          console.log('Socket error (non-critical):', err.message);
        });

        setSocket(newSocket);
      } catch (err) {
        console.log('Socket not available:', err.message);
      }
    };

    connectSocket();

    return () => {
      if (newSocket) newSocket.disconnect();
    };
  }, [user]);

  const markAllRead = () => setUnreadCount(0);

  return (
    <SocketContext.Provider value={{
      socket,
      notifications,
      setNotifications,
      unreadCount,
      setUnreadCount,
      markAllRead
    }}>
      {children}
    </SocketContext.Provider>
  );
};