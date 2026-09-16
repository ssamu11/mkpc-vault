-- Already applied to the connected Supabase project.

create or replace function public.delete_draft_pack_cascade(
  p_pack_id uuid
)
returns integer
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_status text;
  v_count integer;
begin
  if not public.is_staff() then
    raise exception 'Moderator access required';
  end if;

  select status
  into v_status
  from public.packs
  where id = p_pack_id
  for update;

  if v_status is null then
    raise exception 'Pack not found';
  end if;

  if v_status <> 'draft' then
    raise exception
      'Only draft packs can be deleted with their cards';
  end if;

  select count(*)
  into v_count
  from public.cards
  where pack_id = p_pack_id;

  delete from public.cards
  where pack_id = p_pack_id;

  delete from public.packs
  where id = p_pack_id;

  return v_count;
end;
$$;
