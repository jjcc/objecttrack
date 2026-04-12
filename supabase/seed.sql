-- Seed event_types
INSERT INTO public.event_types (label) VALUES
  ('transfer'),
  ('inspection'),
  ('handover'),
  ('maintenance'),
  ('return'),
  ('assignment')
ON CONFLICT (label) DO NOTHING;

-- Seed categories
INSERT INTO public.categories (name, description) VALUES
  ('GeneralElectronics', 'Electronic devices and equipment'),
  ('USBCCamera', 'USB cameras and related accessories'),
  ('MipiCamera', 'MIPI cameras and related accessories'),
  ('GigECamera', 'GigE cameras and related accessories'),
  ('Equipment', 'General equipment and tools'),
  ('Other', 'Miscellaneous items that do not fit into other categorie s')
ON CONFLICT DO NOTHING;
