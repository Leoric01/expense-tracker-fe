import { MenuItemResponseDto } from '@api/model';
import { create } from 'zustand';

interface State {
  menuItem?: MenuItemResponseDto;
  setMenuItem: (menuItem: MenuItemResponseDto) => void;
}

export const useStore = create<State>((set) => ({
  setMenuItem: (menuItem) => set({ menuItem }),
}));
