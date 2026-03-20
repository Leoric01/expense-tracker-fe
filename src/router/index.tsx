import { LayoutWrapper } from '@components/layoutWrapper';
import { AuthRedirect } from '@auth/AuthRedirect';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { NotFound } from '@pages/NotFound';
import { Register } from '@pages/Register';
import { createBrowserRouter } from 'react-router-dom';

export const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LayoutWrapper />
      </ProtectedRoute>
    ),
    children: [{ index: true, element: <Home /> }],
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