import type { ModuleId } from '../../shared/settings';
import type { ParentalStatus } from '../../shared/types';

export interface ParentalView extends ParentalStatus {
  isModuleAllowed: (id: ModuleId) => boolean;
}

// Replaced by the real provider when the parental module is wired up.
export function useParental(): ParentalView | null {
  return null;
}
