-- The partial recommendation index cannot serve the admin's complete archive.
-- Keep all identities visible while avoiding a sort of every wide catalogue row.
create index if not exists watch_catalogue_admin_order_idx
  on private.watch_catalogue (brand, model, id);
