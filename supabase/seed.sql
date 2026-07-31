-- Seed the original/default tenant created by the tenant migration. New
-- tenants receive their own defaults through the provisioning workflow.
WITH seed_tenant AS (
  SELECT min(id) AS tenant_id
  FROM public.tenant
)
INSERT INTO public.event_types (tenant_id, label)
SELECT seed_tenant.tenant_id, seed_event_type.label
FROM seed_tenant
CROSS JOIN (
  VALUES
    ('transfer'),
    ('inspection'),
    ('handover'),
    ('maintenance'),
    ('return'),
    ('assignment')
) AS seed_event_type(label)
WHERE seed_tenant.tenant_id IS NOT NULL
ON CONFLICT (tenant_id, label) DO NOTHING;

-- Seed categories
WITH seed_tenant AS (
  SELECT min(id) AS tenant_id
  FROM public.tenant
),
seed_category(name, description) AS (
  VALUES
    ('GeneralElectronics', 'Electronic devices and equipment'),
    ('USBCCamera', 'USB cameras and related accessories'),
    ('MipiCamera', 'MIPI cameras and related accessories'),
    ('GigECamera', 'GigE cameras and related accessories'),
    ('Equipment', 'General equipment and tools'),
    ('Other', 'Miscellaneous items that do not fit into other categorie s')
)
INSERT INTO public.categories (tenant_id, name, description)
SELECT seed_tenant.tenant_id, seed_category.name, seed_category.description
FROM seed_tenant
CROSS JOIN seed_category
WHERE seed_tenant.tenant_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.categories AS existing_category
    WHERE existing_category.tenant_id = seed_tenant.tenant_id
      AND existing_category.name = seed_category.name
  );
