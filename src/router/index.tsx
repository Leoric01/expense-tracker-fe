import { LayoutWrapper } from '@components/layoutWrapper';
import { AuthRedirect } from '@auth/AuthRedirect';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { NotFound } from '@pages/NotFound';
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
    path: '*',
    element: (
      <ProtectedRoute>
        <NotFound />
      </ProtectedRoute>
    ),
  },
]);