-- D7 narrow public context projection. It returns only an already published
-- story and accepted editorial traits; raw attribution tables remain private.

create or replace function public.discovery_story_context_v1(p_story_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'story', story,
    'traits', jsonb_build_object(
      'socialSignal', traits.social_signal,
      'aestheticDna', traits.aesthetic_dna,
      'deploymentEnvironment', traits.deployment_environment,
      'priceComfort', traits.price_comfort
    )
  )
  from jsonb_array_elements(public.discovery_published_stories_v1()) story
  left join public.discovery_attributions attribution
    on attribution.public_slug = story->>'slug'
   and attribution.review_status = 'accepted'
   and attribution.published_at is not null
  left join public.discovery_attribution_traits traits
    on traits.attribution_id = attribution.id
   and traits.review_status = 'accepted'
  where story->>'slug' = p_story_slug
    and p_story_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$';
$$;

revoke all on function public.discovery_story_context_v1(text) from public;
grant execute on function public.discovery_story_context_v1(text)
  to anon, authenticated, service_role;
