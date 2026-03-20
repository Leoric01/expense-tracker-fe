import { LayoutWrapper } from '@components/layoutWrapper';
import { ProtectedRoute } from '@auth/ProtectedRoute';
import { Activate } from '@pages/Activate';
import { Home } from '@pages/Home';
import { Login } from '@pages/Login';
import { NotFound } from '@pages/NotFound';
import { Register } from '@pages/Register';
import { createBrowserRouter } from 'react-router';

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
    element: <Login />,
  },
  {
    path: '/register',
    element: <Register />,
  },
  {
    path: '/activate',
    element: <Activate />,
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);