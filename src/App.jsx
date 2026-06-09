import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastContainer } from 'react-toastify';
import { AuthProvider, useAuth, homePathForRole } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import LoadingScreen from './components/LoadingScreen';
import SmoothScroll from './components/SmoothScroll';

// Every page is lazy-loaded so the initial bundle only carries the app shell
// (router, layouts, auth) plus whichever page the user actually lands on.
// React Router + the <Suspense> below stream each page's chunk on demand,
// which keeps first load — especially the login-first entry — small and fast.
const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const ResendVerificationPage = lazy(() => import('./pages/ResendVerificationPage'));
const ExposPage = lazy(() => import('./pages/ExposPage'));
const CreateExpoPage = lazy(() => import('./pages/CreateExpoPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ExhibitorPortalPage = lazy(() => import('./pages/ExhibitorPortalPage'));
const BoothManagementPage = lazy(() => import('./pages/BoothManagementPage'));
const PublicFloorPage = lazy(() => import('./pages/PublicFloorPage'));
const SessionsPage = lazy(() => import('./pages/SessionsPage'));
const SponsorsPage = lazy(() => import('./pages/SponsorsPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const FeedbackPage = lazy(() => import('./pages/FeedbackPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminFeedbackPage = lazy(() => import('./pages/admin/AdminFeedbackPage'));
const AdminAnnouncePage = lazy(() => import('./pages/admin/AdminAnnouncePage'));
const AdminActivityPage = lazy(() => import('./pages/admin/AdminActivityPage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
const AttendancePage = lazy(() => import('./pages/admin/AttendancePage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const AboutPage = lazy(() => import('./pages/AboutPage'));
const ServicesPage = lazy(() => import('./pages/ServicesPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const FAQPage = lazy(() => import('./pages/FAQPage'));
const BlogPage = lazy(() => import('./pages/BlogPage'));
// Heavy 3D experience (three.js), chart-heavy dashboard (chart.js) and map-heavy
// expo detail (leaflet) — already split so those libs never touch the main bundle.
const ExperiencePage = lazy(() => import('./pages/ExperiencePage'));
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
        <Route path="attendance" element={<ProtectedRoute roles={['admin','organizer']}><AttendancePage /></ProtectedRoute>} />
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