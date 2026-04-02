import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';

type ProtectedRouteProps = {
  children: ReactNode;
  /** Kam poslat nepřihlášeného uživatele (např. `/admin` u administrace). */
  redirectTo?: string;
};

export const ProtectedRoute = ({ children, redirectTo = '/login' }: ProtectedRouteProps) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!token) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};
