import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

// Next.js serves the API at /api on the same origin (dev and prod), so use a
// relative base URL. NEXT_PUBLIC_API_URL can override it if ever needed.
axios.defaults.baseURL = process.env.NEXT_PUBLIC_API_URL || '';

// Where a user lands after auth, by role.
// Attendees use the public frontend (no back-office dashboard); everyone else gets the dashboard.
export const homePathForRole = (role) => (role === 'attendee' ? '/home' : '/dashboard');

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState(localStorage.getItem('es_token'));

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      fetchMe();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const fetchMe = async () => {
    try {
      const { data } = await axios.get('/api/auth/me');
      setUser(data.user);
    } catch {
      logout();
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const { data } = await axios.post('/api/auth/login', { email, password });
    localStorage.setItem('es_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const register = async (formData) => {
    const { data } = await axios.post('/api/auth/register', formData);
    // New flow: verification required → no token returned; caller shows "check your email"
    if (data.token) {
      localStorage.setItem('es_token', data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
      setToken(data.token);
      setUser(data.user);
    }
    return data;
  };

  // Verify the 6-digit email code (same tab) and log the user straight in.
  const verifyCode = async (email, code) => {
    const { data } = await axios.post('/api/auth/verify-code', { email, code });
    localStorage.setItem('es_token', data.token);
    axios.defaults.headers.common['Authorization'] = `Bearer ${data.token}`;
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('es_token');
    delete axios.defaults.headers.common['Authorization'];
    setToken(null);
    setUser(null);
  };

  const updateProfile = async (profileData) => {
    const { data } = await axios.put('/api/auth/updateprofile', profileData);
    setUser(data.user);
    return data;
  };

  const isAdmin = user?.role === 'admin';
  const isOrganizer = user?.role === 'organizer' || user?.role === 'admin';
  const isExhibitor = user?.role === 'exhibitor';
  const isAttendee = user?.role === 'attendee';

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      login,
      register,
      verifyCode,
      logout,
      updateProfile, 
      isAdmin, 
      isOrganizer, 
      isExhibitor, 
      isAttendee, 
      token 
    }}>
      {children}
    </AuthContext.Provider>
  );
};