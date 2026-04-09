import { useAuth } from '@auth/AuthContext';
import { usePersistStore } from '@components/store/persistStore';

/** Hodnota synchronizovaná z GET /api/nutrition-dashboard (sekce 5, 7). */
export function useNutritionActiveGoalPlanId(trackerId: string | undefined): string | undefined {
  const userId = useAuth().userData?.id ?? '';
  const map = usePersistStore(userId).nutritionActiveGoalPlanByTracker;
  if (!trackerId) {
    return undefined;
  }
  return map[trackerId];
}
