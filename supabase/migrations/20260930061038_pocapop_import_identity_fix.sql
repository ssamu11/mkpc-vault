create or replace function public.resolve_artist(artist text, group_name text, sex text)
returns uuid language plpgsql security invoker set search_path=public as $$
declare gid uuid; iid uuid; cleaned_group text=trim(coalesce(group_name,'')); local_match_count integer;
begin
  if not is_staff() then raise exception 'Moderator access required';end if;
  perform pg_advisory_xact_lock(725193);
  if norm(artist)='' then raise exception 'Idol is required';end if;
  if norm(cleaned_group) in ('solo','soloist') then cleaned_group='';end if;
  if norm(cleaned_group)<>'' then
    insert into groups(name) values(cleaned_group) on conflict(normalized_name) do nothing;
    select id into gid from groups where normalized_name=norm(cleaned_group);
    select i.id into iid from idols i join group_memberships m on m.idol_id=i.id
      where m.group_id=gid and i.normalized_name=norm(artist) order by i.created_at,i.id limit 1;
    if iid is null then
      insert into idols(stage_name,gender) values(trim(artist),coalesce(nullif(norm(sex),''),'unknown')) returning id into iid;
      insert into group_memberships(group_id,idol_id) values(gid,iid) on conflict(group_id,idol_id) do nothing;
    end if;
  else
    -- PostgreSQL has no min(uuid) aggregate; cast only the deterministic identity selection.
    select count(*),min(i.id::text)::uuid into local_match_count,iid from idols i where i.normalized_name=norm(artist);
    if local_match_count>1 then raise exception 'Ambiguous solo artist: %. Resolve identity first.',artist;end if;
    if local_match_count=0 then
      insert into idols(stage_name,gender) values(trim(artist),coalesce(nullif(norm(sex),''),'unknown')) returning id into iid;
    end if;
  end if;
  return iid;
end $$;
