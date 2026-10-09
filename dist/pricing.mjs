// Source: Price List sheet, Fee Quote Calculator, uplifted 28 September 2026.
// Rates are copied as supplied. No additional uplift is applied.
export const SOURCE = { date: '28 September 2026', sheet: 'Price List', filename: 'Fee Quote Calculator - with uplift applied 2026-09-28 (1).xlsx' };
export const PROFILES = [
  { id: 'investment-flat', label: 'Investment entity under $100,000', short: 'Investment entity', base: 1800, turnoverRate: 0, limit: 100000, row: 7 },
  { id: 'investment', label: 'Investment entity under $2 million', short: 'Investment entity', base: 1800, turnoverRate: 0.0015, limit: 2000000, row: 8 },
  { id: 'contractor', label: 'Micro business / single entity / contractor', short: 'Micro business / contractor', base: 3000, turnoverRate: 0.0015, limit: 2000000, row: 9 },
  { id: 'small-fewer', label: 'Small business with fewer than 5 employees', short: 'Small business · fewer than 5 employees', base: 3600, turnoverRate: 0.0015, limit: 5000000, row: 10 },
  { id: 'small-more', label: 'Small business with more than 5 employees', short: 'Small business · more than 5 employees', base: 4800, turnoverRate: 0.0015, limit: 5000000, row: 11 },
];
export const SERVICES = [
  { id: 'delay', label: 'Delay due to client information', section: 'Year-end adjustments', scope: 'business', unit: 'month', low: 360, high: 360, row: 17 },
  { id: 'div7a', label: 'Division 7A', section: 'Year-end adjustments', scope: 'business', unit: 'calculation / documents', low: 1140, high: 1140, row: 18 },
  { id: 'dividends', label: 'Dividends declared', section: 'Year-end adjustments', scope: 'business', unit: 'company', low: 360, high: 360, row: 19 },
  { id: 'bas-amendment', label: 'BAS amendment', section: 'Year-end adjustments', scope: 'business', unit: 'BAS', low: 540, high: 540, row: 20 },
  { id: 'agreement', label: 'Services / hire agreement', section: 'Year-end adjustments', scope: 'business', unit: 'agreement', low: 1800, high: 3000, row: 21 },
  { id: 'payg', label: 'PAYG reporting / amendments', section: 'Year-end adjustments', scope: 'business', unit: 'employee', low: 120, high: 120, row: 22 },
  { id: 'bank', label: 'Unreconciled bank account', section: 'Year-end adjustments', scope: 'business', unit: 'account', low: 720, high: 720, row: 23 },
  { id: 'payroll', label: 'Unreconciled payroll', section: 'Year-end adjustments', scope: 'business', unit: 'reconciliation', low: 360, high: 1800, row: 24 },
  { id: 'business-property-cgt', label: 'CGT on property', section: 'Year-end adjustments', scope: 'business', unit: 'property', low: 1620, high: 1620, row: 25 },
  { id: 'business-shares-cgt', label: 'CGT on shares / units', section: 'Year-end adjustments', scope: 'business', unit: 'holding', low: 180, high: 180, row: 26 },
  { id: 'currency', label: 'Foreign currency translation', section: 'Year-end adjustments', scope: 'business', unit: 'calculation', low: 1140, high: 1140, row: 27 },
  { id: 'bas-preparation', label: 'BAS preparation', section: 'Other services', scope: 'business', unit: 'BAS', low: 660, high: 900, row: 30 },
  { id: 'tax-planning', label: 'Tax planning', section: 'Other services', scope: 'business', unit: 'entity', low: 360, high: 360, row: 31 },
  { id: 'meeting', label: 'Monthly / quarterly review meeting', section: 'Other services', scope: 'business', unit: 'meeting', low: 360, high: 1440, row: 32 },
  { id: 'individual-cgt', label: 'Capital gains tax', section: 'Tax return schedules', scope: 'individual', unit: 'CGT event', low: 480, high: 480, row: 36 },
  { id: 'individual-business', label: 'Business schedule', section: 'Tax return schedules', scope: 'individual', unit: 'business', low: 600, high: 3000, row: 37 },
  { id: 'depreciation', label: 'Depreciation schedule', section: 'Tax return schedules', scope: 'individual', unit: 'schedule', choices: [180, 240], rawMinimum: 240, rawMaximum: 180, row: 38 },
  { id: 'investment-income', label: 'Investment income', section: 'Tax return schedules', scope: 'individual', unit: 'schedule', low: 180, high: 180, row: 39 },
  { id: 'distribution-income', label: 'Distribution income', section: 'Tax return schedules', scope: 'individual', unit: 'schedule', low: 180, high: 180, row: 40 },
  { id: 'foreign-income', label: 'Foreign income', section: 'Tax return schedules', scope: 'individual', unit: 'schedule', low: 180, high: 180, row: 41 },
  { id: 'rental', label: 'Rental property schedule', section: 'Tax return schedules', scope: 'individual', unit: 'property', low: 360, high: 360, row: 42 },
  { id: 'vehicle', label: 'Motor vehicle schedule', section: 'Tax return schedules', scope: 'individual', unit: 'vehicle', low: 180, high: 180, row: 43 },
];
export const GROUP_RULES = {
  medium: { rate: 0.0015, payrollBase: 4000, minEntities: 5, maxEntities: 10, row: 13 },
  large: { rate: 0.001, payrollBase: 4000, minEntities: 11, row: 14 },
};
export const INDIVIDUAL_BASE = 420;
