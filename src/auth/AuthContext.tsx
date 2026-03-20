import { jwtDecode } from 'jwt-decode';
import {
  useCallback,
  useEffect,
  useState,
  createContext,
  FC,
  ReactNode,
  useContext,
} from 'react';
import * as axios from 'axios';
import { clearPersistStoreForUser } from '@components/store/persistStore';

export type UserData = {
  fullName: string;
  id: string;
  sub: string;
  iat: number;
  exp: number;
  authorities: Role[];
};

export enum Role {
  USER = 'USER',
  ADMIN = 'ADMIN',
}

interface AuthContextType {
  token: string | null;
  login: (token: string) => void;
  logout: () => void;
  userData?: UserData;
  isLoading: boolean;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const PRESERVED_LOCAL_STORAGE_KEYS = new Set(['themeMode']);

function clearLocalStorageExceptPreservedKeys() {
  const keysToRemove = Array.from({ length: localStorage.length }, (_, index) => localStorage.key(index))
    .filter((key): key is string => !!key && !PRESERVED_LOCAL_STORAGE_KEYS.has(key));

  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export const AuthProvider: FC<AuthProviderProps> = ({ children }) => {
  const [token, setToken] = useState<string | null>(null);
  const [userData, setUserData] = useState<UserData>();
  const [isLoading, setIsLoading] = useState(true);

  const login = (token: string) => {
    localStorage.setItem('access_token', token);
    axios.default.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    const decoded = jwtDecode<UserData>(token);
    setUserData(decoded);
    setToken(token);
  };

  const logout = useCallback(() => {
    if (userData?.id) {
      clearPersistStoreForUser(userData.id);
    }
    delete axios.default.defaults.headers.common['Authorization'];
    clearLocalStorageExceptPreservedKeys();
    setToken(null);
    setUserData(undefined);
  }, [userData?.id]);

  useEffect(() => {
    const storedToken = localStorage.getItem('access_token');
    if (storedToken) {
      const decoded = jwtDecode<UserData>(storedToken);

      const isExpired = decoded.exp * 1000 < Date.now();
      if (isExpired) {
        clearPersistStoreForUser(decoded.id);
        clearLocalStorageExceptPreservedKeys();
      } else {
        axios.default.defaults.headers.common['Authorization'] =
          `Bearer ${storedToken}`;
        setToken(storedToken);
        setUserData(decoded);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const authForbiddenListener = () => {
      logout();
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    };
    window.addEventListener('auth:forbidden', authForbiddenListener);
    return () => {
      window.removeEventListener('auth:forbidden', authForbiddenListener);
    };
  }, [logout]);

  return (
    <AuthContext.Provider value={{ token, login, logout, userData, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
