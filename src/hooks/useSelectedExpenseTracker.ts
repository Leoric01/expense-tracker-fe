import { useAuth } from '@auth/AuthContext';
import {
  SelectedExpenseTrackerRef,
  usePersistStore,
} from '@components/store/persistStore';

export function useSelectedExpenseTracker(): {
  selectedExpenseTracker: SelectedExpenseTrackerRef | null;
  setSelectedExpenseTracker: (tracker: SelectedExpenseTrackerRef | null) => void;
} {
  const { userData } = useAuth();
  const userId = userData?.id ?? '';
  const { selectedExpenseTracker, setSelectedExpenseTracker } = usePersistStore(userId);

  return { selectedExpenseTracker, setSelectedExpenseTracker };
}
