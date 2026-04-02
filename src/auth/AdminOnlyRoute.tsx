import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { hasAdminRole } from './adminUtils';

/** Vyžaduje platný token a roli ADMIN (stejně jako backend u `/admin/**`). */
export const AdminOnlyRoute = ({ children }: { children: ReactNode }) => {
  const { userData, isLoading, token } = useAuth();

  if (isLoading) {
    return <div style={{ padding: 24 }}>Načítám…</div>;
  }

  if (!token) {
    return <Navigate to="/admin" replace />;
  }

  if (!hasAdminRole(userData)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
