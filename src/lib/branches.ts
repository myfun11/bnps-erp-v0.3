import { BranchLocation } from '../types/database';

export interface BranchMasterItem {
  name: BranchLocation;
  code: string;
  status: 'ACTIVE' | 'UPCOMING';
  role?: string;
  isHQ?: boolean;
}

/**
 * BNPS ERP Canonical Branch Network (Chhattisgarh, India ONLY)
 * Rule: HQ = Jaijaipur (Central Head Office)
 * Total 8 Canonical Branches
 */
export const CANONICAL_BRANCHES: readonly BranchMasterItem[] = [
  { name: 'Jaijaipur', code: 'BNPS-JJP', status: 'ACTIVE', role: 'HQ / Central Head Office', isHQ: true },
  { name: 'Janjgir-Champa', code: 'BNPS-JJC', status: 'ACTIVE' },
  { name: 'Sakti', code: 'BNPS-SKT', status: 'ACTIVE' },
  { name: 'Raigarh', code: 'BNPS-RGH', status: 'UPCOMING' },
  { name: 'Korba', code: 'BNPS-KRB', status: 'UPCOMING' },
  { name: 'Bilaspur', code: 'BNPS-BSP', status: 'UPCOMING' },
  { name: 'Raipur', code: 'BNPS-RPR', status: 'UPCOMING', role: 'Regional Support Branch' },
  { name: 'Basana', code: 'BNPS-BSN', status: 'UPCOMING' },
] as const;

export const BRANCHES_LIST = CANONICAL_BRANCHES.map((b) => b.name) as readonly BranchLocation[];
