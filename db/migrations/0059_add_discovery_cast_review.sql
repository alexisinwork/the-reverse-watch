-- D6 cast relation review. This relation joins already-resolved entities and a
-- work; it never implies ownership, screen wear, or a catalogue fact.

create or replace function public.review_discovery_cast_credit_v1(
  p_public_figure_entity_id bigint,
  p_fictional_character_entity_id bigint,
  p_work_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  credit_id bigint;
  next_status text;
begin
  if p_decision not in ('accepted', 'rejected') then
    raise exception 'Cast review decision is not supported.';
  end if;
  if p_public_figure_entity_id = p_fictional_character_entity_id then
    raise exception 'A cast credit requires separate entities.';
  end if;
  if not exists (
    select 1 from public.discovery_entities entity
    where entity.id = p_public_figure_entity_id
      and entity.entity_kind = 'public_figure'
      and entity.review_status = 'accepted'
  ) then
    raise exception 'Cast credit requires an accepted public-figure entity.';
  end if;
  if not exists (
    select 1 from public.discovery_entities entity
    where entity.id = p_fictional_character_entity_id
      and entity.entity_kind = 'fictional_character'
      and entity.review_status = 'accepted'
  ) then
    raise exception 'Cast credit requires an accepted fictional-character entity.';
  end if;
  if not exists (
    select 1 from public.discovery_works work
    where work.id = p_work_id and work.review_status = 'accepted'
  ) then
    raise exception 'Cast credit requires an accepted work.';
  end if;

  next_status := p_decision;
  select id into credit_id
  from public.discovery_cast_credits
  where public_figure_entity_id = p_public_figure_entity_id
    and fictional_character_entity_id = p_fictional_character_entity_id
    and work_id = p_work_id;
  if credit_id is null then
    insert into public.discovery_cast_credits (
      public_figure_entity_id, fictional_character_entity_id, work_id,
      review_status, reviewed_at
    ) values (
      p_public_figure_entity_id, p_fictional_character_entity_id, p_work_id,
      next_status, now()
    ) returning id into credit_id;
  else
    update public.discovery_cast_credits
    set review_status = next_status, reviewed_at = now(), updated_at = now()
    where id = credit_id;
  end if;
  return jsonb_build_object('status', next_status, 'castCreditId', credit_id);
end;
$$;

revoke all on function public.review_discovery_cast_credit_v1(
  bigint, bigint, bigint, text
) from public, anon, authenticated;
grant execute on function public.review_discovery_cast_credit_v1(
  bigint, bigint, bigint, text
) to service_role;
