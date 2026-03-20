import { Navigate } from 'react-router';
import { useAuth } from './AuthContext';

export const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { token, isLoading } = useAuth();

  // Show loading or wait until authentication check is complete
  if (isLoading) {
    return <div style={{ padding: 20 }}>Loading...</div>; // Show loading state instead of blank page
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};
