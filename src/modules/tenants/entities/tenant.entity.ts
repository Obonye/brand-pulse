export interface Tenant {
    id: string;
    name: string;
    slug: string;
    email: string;
    phone?: string;
    industry: string;
    subscription_tier: 'basic' | 'professional' | 'enterprise';
    subscription_active: boolean;
    created_at: string;
    updated_at: string;
  }
  
  export interface User {
    id: string;
    tenant_id: string;
    supabase_auth_id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: 'owner' | 'admin' | 'analyst' | 'viewer';
    is_active: boolean;
    tenants?: Tenant;
  }