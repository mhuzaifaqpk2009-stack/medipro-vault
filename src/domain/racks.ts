export interface PharmacyRack {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export const DEFAULT_RACKS: PharmacyRack[] = [];
