import { Navigate } from 'react-router';
import { useAuth } from './AuthContext';

export const AuthRedirect = () => {
  const { token, isLoading } = useAuth();

  // Wait until authentication check is complete
  if (isLoading) {
    return null; // or a loading spinner
  }

  return token ? <Navigate to="/" replace /> : <Navigate to="/login" replace />;
};
