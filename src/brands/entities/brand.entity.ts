export interface Brand {
  id: string;
  tenant_id: string;
  name: string;
  description?: string;
  website?: string;
  logoUrl?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}