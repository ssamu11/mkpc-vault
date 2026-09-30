create or replace function public.save_pocapop_discovery_draft(payload jsonb) returns uuid
language plpgsql security invoker set search_path=public as $$
declare
  row_data jsonb; artist_data jsonb; rows_data jsonb='[]';
  iid uuid; gid uuid; ref_id text; ref_group text; artist_name text; group_name text; sex text;
  pid uuid; seen uuid[]='{}'; local_group_key text; reference_group_key text;
begin
  if not public.is_staff() then raise exception 'Moderator access required';end if;
  if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows') not in (24,48) then
    raise exception 'Invalid planned pack';end if;
  perform pg_advisory_xact_lock(725193);
  for row_data in select value from jsonb_array_elements(payload->'rows') loop
    iid=null; gid=null;
    artist_data=row_data->'new_artist';
    if artist_data is not null and artist_data<>'null'::jsonb then
      ref_id=artist_data->>'kpopping_artist_id';ref_group=artist_data->>'kpopping_group_id';
      artist_name=null; group_name=null; sex=null;
      select a.stage_name,g.name,case g.group_type when 'girl_group' then 'female' when 'boy_group' then 'male' end
      into artist_name,group_name,sex
      from public.kpopping_artists a
      join public.kpopping_memberships m on m.kpopping_artist_id=a.kpopping_artist_id
      join public.kpopping_groups g on g.kpopping_group_id=m.kpopping_group_id
      where a.kpopping_artist_id=ref_id and g.kpopping_group_id=ref_group and m.leave_date is null
        and (m.role is null or m.role in ('member','idol','artist'))
        and g.status in ('active','hiatus') and g.entity_type='human' limit 1;
      if artist_name is null or sex is null or artist_data->>'gender' is distinct from sex or
         public.norm(artist_data->>'stage_name') is distinct from public.norm(artist_name) then
        raise exception 'Reference artist changed. Reload the planner.';end if;
      if (select count(*) from public.idol_kpopping_links where kpopping_artist_id=ref_id and confirmed)>1 then
        raise exception 'Reference identity is ambiguous. Resolve its links first.';end if;
      select idol_id into iid from public.idol_kpopping_links where kpopping_artist_id=ref_id and confirmed;
      select group_id into gid from public.group_kpopping_links where kpopping_group_id=ref_group and confirmed order by group_id limit 1;
      -- Retain the game's approved group spelling when only its abbreviation differs.
      if gid is null then
        local_group_key=regexp_replace(public.norm(artist_data->>'group_name'),'[^[:alnum:]]','','g');
        reference_group_key=regexp_replace(public.norm(group_name),'[^[:alnum:]]','','g');
        local_group_key=case local_group_key when 'txt' then 'tomorrowxtogether' when 'ald1' then 'alphadriveone' when 'gidle' then 'idle' when 'snsd' then 'girlsgeneration' else local_group_key end;
        reference_group_key=case reference_group_key when 'txt' then 'tomorrowxtogether' when 'ald1' then 'alphadriveone' when 'gidle' then 'idle' when 'snsd' then 'girlsgeneration' else reference_group_key end;
        if local_group_key=reference_group_key then
          select id into gid from public.groups where normalized_name=public.norm(artist_data->>'group_name');
        end if;
      end if;
      if gid is not null then select name into group_name from public.groups where id=gid;end if;
      if public.norm(artist_data->>'group_name') is distinct from public.norm(group_name) then
        raise exception 'Reference group changed. Reload the planner.';end if;
      if iid is null then iid=public.resolve_artist(artist_name,group_name,sex);end if;
      if gid is null then select id into gid from public.groups where normalized_name=public.norm(group_name);end if;
      if exists(select 1 from public.idol_kpopping_links where idol_id=iid and (kpopping_artist_id<>ref_id or not confirmed)) or
         exists(select 1 from public.group_kpopping_links where group_id=gid and (kpopping_group_id<>ref_group or not confirmed)) then
        raise exception 'Existing reference identity conflicts. Resolve its links first.';end if;
      insert into public.idol_kpopping_links(idol_id,kpopping_artist_id,match_method,confirmed)
        values(iid,ref_id,'planner_reference',true) on conflict(idol_id) do nothing;
      insert into public.group_kpopping_links(group_id,kpopping_group_id,match_method,confirmed)
        values(gid,ref_group,'planner_reference',true) on conflict(group_id) do nothing;
    else
      iid=nullif(row_data->>'idol_id','')::uuid;
    end if;
    if iid is null or iid=any(seen) then raise exception 'Invalid or repeated artist';end if;
    seen=array_append(seen,iid);
    rows_data=rows_data||jsonb_build_array((row_data-'new_artist')||jsonb_build_object('idol_id',iid));
  end loop;
  pid=public.save_pocapop_draft(payload||jsonb_build_object('rows',rows_data));
  return pid;
end $$;
