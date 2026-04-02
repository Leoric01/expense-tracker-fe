import type { UserData } from './AuthContext';
import { Role } from './AuthContext';

export function hasAdminRole(userData?: UserData): boolean {
  if (!userData?.authorities?.length) return false;
  return userData.authorities.some((a) => a === Role.ADMIN || String(a) === 'ADMIN');
}
