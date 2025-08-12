export interface TagIntent {
  id: string;
  tenant_id?: string;
  name: string;
  display_name: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}