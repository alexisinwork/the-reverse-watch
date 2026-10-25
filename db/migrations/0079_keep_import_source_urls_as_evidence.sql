-- Dataset URLs are provenance, not manufacturer confirmation. Their originals
-- remain in every intake payload; reserve catalogue source_url for checked pages.
update private.watch_catalogue
set source_url=null
where import_source='timepiecepedia' and not reference_confirmed
  and source_kind is null and source_url like 'https://timepiecepedia.com/%';
