export type MedicineSearchField = 'name' | 'genericName' | 'company';

export const MEDICINE_SEARCH_FIELDS: MedicineSearchField[] = [
  'name',
  'genericName',
  'company',
];

export function medicineSearchLabel(field: MedicineSearchField): string {
  switch (field) {
    case 'genericName': return 'Generic';
    case 'company': return 'Company';
    default: return 'Name';
  }
}
