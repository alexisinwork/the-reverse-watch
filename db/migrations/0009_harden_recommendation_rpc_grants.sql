-- The deployed application uses the publishable key's anonymous role for
-- these narrow, read-only contracts. Signed-in users do not need a second
-- execution path, and catalogue tables remain inaccessible to both roles.

revoke execute on function recommendation_catalogue_v1() from authenticated;
revoke execute on function recommendation_hard_filter_v1(jsonb, timestamptz)
  from authenticated;
