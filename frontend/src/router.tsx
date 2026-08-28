import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from '@/components/layout/AdminLayout'
import { DashboardLayout } from '@/components/layout/DashboardLayout'
import { AdminRoute } from '@/components/common/AdminRoute'
import { GuestRoute } from '@/components/common/GuestRoute'
import { ProtectedRoute } from '@/components/common/ProtectedRoute'
import { AdminAuditLogPage } from '@/features/admin/pages/AdminAuditLogPage'
import { AdminDashboardPage } from '@/features/admin/pages/AdminDashboardPage'
import { AdminEpksPage } from '@/features/admin/pages/AdminEpksPage'
import { AdminUsersPage } from '@/features/admin/pages/AdminUsersPage'
import { AdminWorkspacesPage } from '@/features/admin/pages/AdminWorkspacesPage'
import { ForgotPasswordPage } from '@/features/auth/pages/ForgotPasswordPage'
import { LoginPage } from '@/features/auth/pages/LoginPage'
import { RegisterPage } from '@/features/auth/pages/RegisterPage'
import { ResetPasswordPage } from '@/features/auth/pages/ResetPasswordPage'
import { VerifyEmailPage } from '@/features/auth/pages/VerifyEmailPage'
import { AnalyticsPage } from '@/features/analytics/pages/AnalyticsPage'
import { EpkBuilderPage } from '@/features/epks/builder/EpkBuilderPage'
import { EpksListPage } from '@/features/epks/pages/EpksListPage'
import { PrivateEpkPage } from '@/features/private-epk/PrivateEpkPage'
import { PublicEpkPage } from '@/features/public-epk/PublicEpkPage'
import { MediaLibraryPage } from '@/features/media/pages/MediaLibraryPage'
import { SettingsPage } from '@/features/settings/pages/SettingsPage'
import { TeamPage } from '@/features/workspaces/pages/TeamPage'
import { AcceptInvitationPage } from '@/features/workspaces/pages/AcceptInvitationPage'
import { ContactsPage } from '@/features/contacts/pages/ContactsPage'
import { BillingPage } from '@/features/billing/pages/BillingPage'
import { DashboardHome } from '@/pages/DashboardHome'
import { NotFoundPage } from '@/pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
      { path: '/forgot-password', element: <ForgotPasswordPage /> },
      { path: '/reset-password/:token', element: <ResetPasswordPage /> },
    ],
  },
  { path: '/verify-email', element: <VerifyEmailPage /> },
  { path: '/epk/:slug', element: <PublicEpkPage /> },
  { path: '/private/:token', element: <PrivateEpkPage /> },
  // Not wrapped in ProtectedRoute or GuestRoute — it has to work for a
  // visitor who isn't logged in at all yet (the whole point: create a
  // password or log in right here) as well as one who already is.
  { path: '/invitations/:token', element: <AcceptInvitationPage /> },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AdminRoute />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminDashboardPage /> },
              { path: 'users', element: <AdminUsersPage /> },
              { path: 'workspaces', element: <AdminWorkspacesPage /> },
              { path: 'epks', element: <AdminEpksPage /> },
              { path: 'audit-log', element: <AdminAuditLogPage /> },
            ],
          },
        ],
      },
      {
        element: <DashboardLayout />,
        children: [
          { path: '/', element: <DashboardHome /> },
          { path: '/epks', element: <EpksListPage /> },
          { path: '/epks/:epkId/builder', element: <EpkBuilderPage /> },
          { path: '/media', element: <MediaLibraryPage /> },
          { path: '/analytics', element: <AnalyticsPage /> },
          { path: '/contacts', element: <ContactsPage /> },
          { path: '/team', element: <TeamPage /> },
          { path: '/settings', element: <SettingsPage /> },
          { path: '/billing', element: <BillingPage /> },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
