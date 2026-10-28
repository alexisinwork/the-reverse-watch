-- The recommendation pool has grown to 25k+ rows. Match its eligibility
-- predicate and stable ordering so each page avoids a full heap scan/sort.
create index watch_catalogue_recommendation_order_idx
  on private.watch_catalogue(brand,model,id)
  where import_source is null or (price_amount is not null and price_status<>'unconfirmed');
