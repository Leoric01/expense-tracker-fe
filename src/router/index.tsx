import { LayoutWrapper } from '@components/layoutWrapper';
import { AdminOnlyRoute } from '@auth/AdminOnlyRoute';
import { AuthRedirect } from '@auth/AuthRedirect';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { AdminLogin } from '@pages/admin/AdminLogin';
import { AdminPortal } from '@pages/admin/AdminPortal';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { NotFound } from '@pages/NotFound';
import { CategoriesPage } from '@pages/categories/CategoriesPage';
import { ExpenseTrackers } from '@pages/ExpenseTrackers';
import { Profile } from '@pages/Profile';
import { Register } from '@pages/Register';
import { createBrowserRouter, Navigate } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LayoutWrapper />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'trackers', element: <ExpenseTrackers /> },
      { path: 'categories', element: <CategoriesPage /> },
      { path: 'wallets', element: <Navigate to="/" replace /> },
      { path: 'transactions', element: <Navigate to="/" replace /> },
      /** SPA route — must not be `/profile` (conflicts with API `GET /profile` + Vite proxy). */
      { path: 'settings', element: <Profile /> },
      { path: 'profile', element: <Navigate to="/settings" replace /> },
    ],
    errorElement: <NotFound />,
  },
  {
    path: '/login',
    element: (
      <AuthRedirect>
        <Login />
      </AuthRedirect>
    ),
  },
  {
    path: '/register',
    element: (
      <AuthRedirect>
        <Register />
      </AuthRedirect>
    ),
  },
  {
    path: '/activate',
    element: (
      <AuthRedirect>
        <Activate />
      </AuthRedirect>
    ),
  },
  {
    path: '/admin',
    element: <AdminLogin />,
  },
  {
    path: '/admin/portal',
    element: (
      <ProtectedRoute redirectTo="/admin">
        <AdminOnlyRoute>
          <AdminPortal />
        </AdminOnlyRoute>
      </ProtectedRoute>
    ),
  },
  {
    path: '*',
    element: (
      <ProtectedRoute>
        <NotFound />
      </ProtectedRoute>
    ),
  },
]);