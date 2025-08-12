export interface Brand {
    id: string;
    tenant_id: string;
    name: string;
    description?: string;
    website_url?: string;
    logo_url?: string;
    keywords: string[];
    competitor_brands: string[];
    location?: string;
    industry_id?: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}