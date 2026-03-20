import { BranchResponseDto } from '@api/model';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserPersistentState {
  selectedBranch: BranchResponseDto | null;
  setSelectedBranch: (branch: BranchResponseDto | null) => void;
  clearUserData: () => void;
}

// Cache stores by userId
const stores: Map<string, ReturnType<typeof createUserPersistStore>> = new Map();

export const createUserPersistStore = (userId: string) => {
  return create<UserPersistentState>()(
    persist(
      (set) => ({
        selectedBranch: null,
        setSelectedBranch: (branch) => set({ selectedBranch: branch }),
        clearUserData: () => set({ selectedBranch: null }),
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