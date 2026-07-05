import type { MaintenancePriority } from '../types';

// Backend stores priority as an integer (see CreateMaintenanceScreen):
// LOW=1, MEDIUM=2, HIGH=3, URGENT=4. This maps it back to a label key.
export const numberToPriority = (n: number): MaintenancePriority => {
  switch (n) {
    case 1:
      return 'LOW';
    case 2:
      return 'MEDIUM';
    case 3:
      return 'HIGH';
    default:
      return 'URGENT';
  }
};
