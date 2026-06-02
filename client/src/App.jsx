import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth, homePathForRole } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResendVerificationPage from './pages/ResendVerificationPage';
import ExposPage from './pages/ExposPage';
import CreateExpoPage from './pages/CreateExpoPage';
import ProfilePage from './pages/ProfilePage';
import ExhibitorPortalPage from './pages/ExhibitorPortalPage';
import BoothManagementPage from './pages/BoothManagementPage';
import PublicFloorPage from './pages/PublicFloorPage';
import SessionsPage from './pages/SessionsPage';
import SponsorsPage from './pages/SponsorsPage';
import MessagesPage from './pages/MessagesPage';
import FeedbackPage from './pages/FeedbackPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminFeedbackPage from './pages/admin/AdminFeedbackPage';
import AdminAnnouncePage from './pages/admin/AdminAnnouncePage';
import AdminActivityPage from './pages/admin/AdminActivityPage';
import CheckInPage from './pages/CheckInPage';
import NotFoundPage from './pages/NotFoundPage';
import AboutPage from './pages/AboutPage';
import ServicesPage from './pages/ServicesPage';
import ContactPage from './pages/ContactPage';
import FAQPage from './pages/FAQPage';
import BlogPage from './pages/BlogPage';
import LoadingScreen from './components/LoadingScreen';
import SmoothScroll from './components/SmoothScroll';

// Heavy 3D experience — lazy load so it doesn't bloat the main bundle
const ExperiencePage = lazy(() => import('./pages/ExperiencePage'));
// Lazy-load the chart-heavy dashboard (chart.js) and map-heavy expo detail (leaflet)
// so those libraries split into their own chunks instead of the main bundle.
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const ExpoDetailPage = lazy(() => import('./pages/ExpoDetailPage'));

const ProtectedRoute = ({ children, roles }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={homePathForRole(user.role)} replace />;
  return children;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to={homePathForRole(user.role)} replace />;
  return children;
};

// Login-first entry gate: authenticated users skip straight to their home
// (frontend for attendees, dashboard for everyone else); others go to login.
const RootRedirect = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return <Navigate to={user ? homePathForRole(user.role) : '/login'} replace />;
};

function AppRoutes() {
  return (
    <Routes>
      {/* Fullscreen immersive 3D experience — sits outside Layout */}
      <Route
        path="/experience"
        element={
          <ProtectedRoute>
            <Suspense fallback={<LoadingScreen />}>
              <ExperiencePage />
            </Suspense>
          </ProtectedRoute>
        }
      />

      {/* Dashboard back-office — its own shell, separate from the public site Layout.
          Attendees have no dashboard (they use the frontend); admin-only sections guarded individually. */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute roles={['admin', 'superadmin', 'organizer', 'exhibitor']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="checkin" element={<ProtectedRoute roles={['admin','organizer']}><CheckInPage /></ProtectedRoute>} />
        <Route path="messages" element={<MessagesPage />} />
        <Route path="users" element={<ProtectedRoute roles={['admin']}><AdminUsersPage /></ProtectedRoute>} />
        <Route path="feedback" element={<ProtectedRoute roles={['admin']}><AdminFeedbackPage /></ProtectedRoute>} />
        <Route path="announce" element={<ProtectedRoute roles={['admin']}><AdminAnnouncePage /></ProtectedRoute>} />
        <Route path="activity" element={<ProtectedRoute roles={['admin']}><AdminActivityPage /></ProtectedRoute>} />
      </Route>

      <Route path="/" element={<Layout />}>
        {/* Login-first entry: "/" sends users to login (or their dashboard if already signed in) */}
        <Route index element={<RootRedirect />} />

        {/* Public auth flow — reachable without a session so users can sign in / recover access */}
        <Route path="login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
        <Route path="reset-password/:token" element={<PublicRoute><ResetPasswordPage /></PublicRoute>} />
        <Route path="verify-email/:token" element={<VerifyEmailPage />} />
        <Route path="resend-verification" element={<ResendVerificationPage />} />

        {/* Deliberately public share link (floor plan opened via QR / shared URL) */}
        <Route path="expos/:id/floor" element={<PublicFloorPage />} />

        {/* Everything below requires authentication */}
        <Route path="home" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
        <Route path="expos" element={<ProtectedRoute><ExposPage /></ProtectedRoute>} />
        <Route path="expos/create" element={<ProtectedRoute roles={['admin','organizer']}><CreateExpoPage /></ProtectedRoute>} />
        <Route path="expos/:id" element={<ProtectedRoute><ExpoDetailPage /></ProtectedRoute>} />
        <Route path="expos/:id/edit" element={<ProtectedRoute roles={['admin','organizer']}><CreateExpoPage /></ProtectedRoute>} />
        <Route path="expos/:id/booths" element={<ProtectedRoute><BoothManagementPage /></ProtectedRoute>} />
        <Route path="expos/:id/sessions" element={<ProtectedRoute><SessionsPage /></ProtectedRoute>} />
        <Route path="expos/:id/sponsors" element={<ProtectedRoute roles={['admin','organizer']}><SponsorsPage /></ProtectedRoute>} />
        <Route path="profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="exhibitor-portal" element={<ProtectedRoute roles={['exhibitor']}><ExhibitorPortalPage /></ProtectedRoute>} />
        <Route path="feedback" element={<ProtectedRoute><FeedbackPage /></ProtectedRoute>} />
        <Route path="about" element={<ProtectedRoute><AboutPage /></ProtectedRoute>} />
        <Route path="services" element={<ProtectedRoute><ServicesPage /></ProtectedRoute>} />
        <Route path="contact" element={<ProtectedRoute><ContactPage /></ProtectedRoute>} />
        <Route path="faq" element={<ProtectedRoute><FAQPage /></ProtectedRoute>} />
        <Route path="blog" element={<ProtectedRoute><BlogPage /></ProtectedRoute>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <SmoothScroll>
            <Suspense fallback={<LoadingScreen />}>
              <AppRoutes />
            </Suspense>
          </SmoothScroll>
          <ToastContainer
            position="top-right"
            autoClose={3000}
            theme="colored"
          />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;