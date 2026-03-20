import { Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './AuthContext';

export const AuthRedirect = ({ children }: { children: ReactNode }) => {
  const { token, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (token) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
