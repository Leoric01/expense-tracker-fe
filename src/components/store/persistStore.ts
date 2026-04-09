import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SelectedExpenseTrackerRef = {
  id: string;
  name: string;
};

interface UserPersistentState {
  selectedExpenseTracker: SelectedExpenseTrackerRef | null;
  setSelectedExpenseTracker: (tracker: SelectedExpenseTrackerRef | null) => void;
  /** trackerId → active goal plan ID (sync z nutrition dashboard API; sekce 5, 7) */
  nutritionActiveGoalPlanByTracker: Record<string, string>;
  setNutritionActiveGoalPlan: (trackerId: string, goalPlanId: string | null) => void;
  clearUserData: () => void;
}

// Cache stores by userId
const stores: Map<string, ReturnType<typeof createUserPersistStore>> = new Map();

export const createUserPersistStore = (userId: string) => {
  return create<UserPersistentState>()(
    persist(
      (set) => ({
        selectedExpenseTracker: null,
        setSelectedExpenseTracker: (tracker) => set({ selectedExpenseTracker: tracker }),
        nutritionActiveGoalPlanByTracker: {},
        setNutritionActiveGoalPlan: (trackerId, goalPlanId) =>
          set((state) => {
            const next = { ...state.nutritionActiveGoalPlanByTracker };
            if (goalPlanId === null || goalPlanId === '') {
              delete next[trackerId];
            } else {
              next[trackerId] = goalPlanId;
            }
            return { nutritionActiveGoalPlanByTracker: next };
          }),
        clearUserData: () =>
          set({ selectedExpenseTracker: null, nutritionActiveGoalPlanByTracker: {} }),
      }),
      {
        name: `user-${userId}-storage`,
      },
    ),
  );
};

export const usePersistStore = (userId: string) => {
  if (!stores.has(userId)) {
    stores.set(userId, createUserPersistStore(userId));
  }
  return stores.get(userId)!();
};

export const clearPersistStoreForUser = (userId: string) => {
  if (stores.has(userId)) {
    const store = stores.get(userId)!;
    store.getState().clearUserData();
    stores.delete(userId); // Remove from cache to force recreation on next access
  }
  localStorage.removeItem(`user-${userId}-storage`);
};