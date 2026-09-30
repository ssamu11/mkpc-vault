create function public.import_pocapop_workbook(payload jsonb) returns jsonb
language plpgsql security invoker set search_path=public as $$
declare
  pack jsonb; row_data jsonb; pid uuid; iid uuid; gid uuid; rid uuid; cid uuid;
  old public.cards%rowtype; counts integer[]; weights bigint[]; premium boolean;
  key text; i integer; target integer; made integer=0; changed integer=0; skipped integer=0;
  seen uuid[]; slots text[]; seen_packs text[] := '{}'; total integer=0;
begin
  if not public.is_staff() then raise exception 'Moderator access required'; end if;
  if jsonb_typeof(payload->'packs') is distinct from 'array' or jsonb_array_length(payload->'packs') not between 1 and 200 then raise exception 'Invalid workbook selection'; end if;
  perform pg_advisory_xact_lock(725193);
  for pack in select value from jsonb_array_elements(payload->'packs') loop
    if pack->>'code'=any(seen_packs) then raise exception 'Duplicate PackID'; end if;
    seen_packs=array_append(seen_packs,pack->>'code');
    if coalesce(pack->>'type','') not in ('Rebirth','Premium') or trim(coalesce(pack->>'name',''))='' then raise exception 'Pack type and name required'; end if;
    premium=pack->>'type'='Premium';
    if coalesce(pack->>'code','') !~ (case when premium then '^HB[0-9]{2,6}$' else '^RB[0-9]{2,6}$' end) then raise exception 'Invalid PackID';end if;
    counts=case when premium then array[0,0,10,8,4,2] else array[18,12,8,6,2,2] end;
    weights=case when premium then array[0,0,7000000,2580000,400000,20000]::bigint[] else array[7000000,2000000,700000,240000,56000,4000]::bigint[] end;
    target=case when premium then 24 else 48 end;
    if jsonb_typeof(pack->'rows') is distinct from 'array' or jsonb_array_length(pack->'rows')<>target then raise exception 'Incorrect pack size';end if;
    total=total+target;
    if total>10000 then raise exception 'Workbook row limit exceeded';end if;
    pid=null; select id into pid from public.packs where game_pack_id=pack->>'code' for update;
    if pid is distinct from nullif(pack->>'existing_id','')::uuid then raise exception 'Catalog changed. Reload the import preview.';end if;
    if pid is null then
      insert into public.packs(name,game_pack_id,pack_type,pack_number,catalog_size,status,catalog_status)
      values(pack->>'name',pack->>'code',pack->>'type',substring(pack->>'code' from 3)::integer,target,'draft','Draft') returning id into pid;
    elsif exists(select 1 from public.packs where id=pid and (pack_type<>pack->>'type' or exclusive)) or
      (select count(*) from public.cards where pack_id=pid)<>target then raise exception 'Existing pack layout differs';end if;
    for i in 1..6 loop
      key=(array['Common','Uncommon','Rare','Epic','Legendary','Mythic'])[i];
      select id into rid from public.rarities where game_key=key and active;
      if counts[i]>0 and rid is null then raise exception 'Missing active tier %',key;end if;
      if (select count(*) from jsonb_array_elements(pack->'rows') x where x->>'rarity_id'=rid::text)<>counts[i] then raise exception 'Incorrect % count',key;end if;
      if counts[i]>0 then
        if (select count(*) from jsonb_array_elements(pack->'rows') x where x->>'rarity_id'=rid::text and x->>'gender'='female')<>counts[i]/2 or
           (select count(*) from jsonb_array_elements(pack->'rows') x where x->>'rarity_id'=rid::text and x->>'gender'='male')<>counts[i]/2 then raise exception 'Each tier requires equal female and male cards';end if;
        insert into public.pack_rarities values(pid,rid,case when premium then (array['','','Petal','Silk','Royal','Crown'])[i] else key end,counts[i],counts[i]/2,counts[i]/2,weights[i],10000000)
        on conflict(pack_id,rarity_id) do update set display_name=excluded.display_name,card_count=excluded.card_count,female_count=excluded.female_count,male_count=excluded.male_count,weight=excluded.weight,total_weight=excluded.total_weight;
      end if;
    end loop;
    seen='{}'; slots='{}';
    for row_data in select value from jsonb_array_elements(pack->'rows') loop
      if coalesce(row_data->>'slot','') !~ '^[0-9]{1,3}$' or (row_data->>'slot')::integer not between 1 and target or
        (row_data->>'slot')::integer::text=any(slots) then raise exception 'Invalid or repeated slot';end if;
      slots=array_append(slots,(row_data->>'slot')::integer::text);
      if trim(coalesce(row_data->>'idol',''))='' or coalesce(row_data->>'gender','') not in ('female','male') then raise exception 'Artist name/gender required';end if;
      iid=public.resolve_artist(row_data->>'idol',row_data->>'group',row_data->>'gender');
      if nullif(row_data->>'idol_id','') is not null and iid<>(row_data->>'idol_id')::uuid then raise exception 'Artist identity changed';end if;
      if iid=any(seen) or not exists(select 1 from public.idols where id=iid and gender=row_data->>'gender' and active and coalesce(game_idol_id,'') not like '%-GROUP') then raise exception 'Invalid or repeated artist';end if;
      seen=array_append(seen,iid);
      if nullif(row_data->>'game_idol_id','') is not null and not exists(select 1 from public.idols where id=iid and game_idol_id=row_data->>'game_idol_id') then raise exception 'Idol ID mismatch';end if;
      gid=null; select id into gid from public.groups where normalized_name=public.norm(row_data->>'group');
      if nullif(row_data->>'game_group_id','') is not null and row_data->>'game_group_id'<>'GROUP-SOLO' and not exists(select 1 from public.groups where id=gid and game_group_id=row_data->>'game_group_id') then raise exception 'Group ID mismatch';end if;
      cid=nullif(row_data->>'existing_card_id','')::uuid;
      old=null;
      if cid is not null then
        select * into old from public.cards where id=cid and pack_id=pid for update;
        if old.id is null or (select count(*) from public.card_idols where card_id=cid)<>1 or not exists(select 1 from public.card_idols where card_id=cid and idol_id=iid) then raise exception 'Card identity changed';end if;
        if old.updated_at is distinct from (row_data->>'expected_updated_at')::timestamptz then raise exception 'Card changed. Reload the import preview.';end if;
      elsif nullif(pack->>'existing_id','') is not null then raise exception 'Existing lineup cannot be silently replaced';end if;
      if nullif(row_data->>'game_card_id','') is not null and row_data->>'game_card_id' not like (pack->>'code')||'-%' then raise exception 'CardID prefix mismatch';end if;
      if nullif(row_data->>'image_asset_id','') is not null and row_data->>'image_asset_id' !~ '^[0-9]{1,16}$' then raise exception 'Invalid image asset ID';end if;
      rid=(row_data->>'rarity_id')::uuid;
      if not exists(select 1 from public.pack_rarities where pack_id=pid and rarity_id=rid) then raise exception 'Tier not configured';end if;
      if cid is not null and old.rarity_id=rid and
        (nullif(row_data->>'image_asset_id','') is null or old.image_asset_id=row_data->>'image_asset_id') and
        (nullif(row_data->>'game_card_id','') is null or old.game_card_id=row_data->>'game_card_id') and
        (nullif(row_data->>'notes','') is null or coalesce(old.notes,'')=row_data->>'notes') and
        (nullif(row_data->>'pic_status','') is null or coalesce(old.pic_status,'')=row_data->>'pic_status') then skipped=skipped+1;continue;end if;
      perform public.save_card(jsonb_build_object(
        'id',cid,'pack_id',pid,'rarity_id',rid,'group_id',coalesce(old.group_id,gid),
        'slot',coalesce(old.slot,row_data->>'slot'),'idol_ids',jsonb_build_array(iid),
        'game_card_id',coalesce(nullif(row_data->>'game_card_id',''),old.game_card_id),
        'image_asset_id',coalesce(nullif(row_data->>'image_asset_id',''),old.image_asset_id),
        'catalog_status',coalesce(old.catalog_status,'Draft'),
        'premium_tier',case when premium then (select display_name from public.pack_rarities where pack_id=pid and rarity_id=rid) else null end,
        'pic_status',coalesce(nullif(row_data->>'pic_status',''),old.pic_status,case when nullif(row_data->>'image_asset_id','') is null then 'To Find' else 'Selected' end),
        'notes',coalesce(nullif(row_data->>'notes',''),old.notes),'source_url',coalesce(old.source_url,'')
      ));
      if cid is null then made=made+1;else changed=changed+1;end if;
    end loop;
  end loop;
  insert into public.import_history(filename,rows_processed,rows_created,rows_skipped,warnings)
  values(left(coalesce(payload->>'filename','Workbook'),255),total,made+changed,skipped,jsonb_build_array(changed::text||' cards updated'));
  return jsonb_build_object('created',made,'updated',changed,'skipped',skipped);
end $$;
revoke all on function public.import_pocapop_workbook(jsonb) from public,anon;
grant execute on function public.import_pocapop_workbook(jsonb) to authenticated;

create or replace function public.save_pocapop_draft(payload jsonb) returns uuid
language plpgsql security invoker set search_path=public as $draft$
declare pid uuid; row_data jsonb; iid uuid; gid uuid; rid uuid; counts integer[]; weights bigint[];
  i integer; key text; premium boolean; target integer; seen uuid[] := '{}'; slots text[] := '{}';
begin
  if not is_staff() then raise exception 'Moderator access required';end if;
  perform pg_advisory_xact_lock(725193);
  if coalesce(payload->>'pack_type','') not in ('Rebirth','Premium') then raise exception 'Unsupported pack type';end if;
  if trim(coalesce(payload->>'name',''))='' then raise exception 'Pack name required';end if;
  premium=payload->>'pack_type'='Premium';
  target=case when premium then 24 else 48 end;
  counts=case when premium then array[0,0,10,8,4,2] else array[18,12,8,6,2,2] end;
  weights=case when premium then array[0,0,7000000,2580000,400000,20000]::bigint[] else array[7000000,2000000,700000,240000,56000,4000]::bigint[] end;
  if jsonb_typeof(payload->'rows') is distinct from 'array' or jsonb_array_length(payload->'rows')<>target then raise exception 'Pack size does not match PocaPop layout';end if;
  if coalesce(payload->>'game_pack_id','') !~ (case when premium then '^HB[0-9]{2,6}$' else '^RB[0-9]{2,6}$' end) then raise exception 'PackID prefix does not match pack type';end if;
  insert into packs(name,game_pack_id,pack_type,pack_number,catalog_size,status,catalog_status)
    values(payload->>'name',payload->>'game_pack_id',payload->>'pack_type',substring(payload->>'game_pack_id' from 3)::integer,target,'draft','Draft') returning id into pid;
  for i in 1..6 loop
    key=(array['Common','Uncommon','Rare','Epic','Legendary','Mythic'])[i];
    if counts[i]=0 then continue;end if;
    select id into rid from rarities where game_key=key and active;
    if rid is null then raise exception 'Missing active tier %',key;end if;
    if (select count(*) from jsonb_array_elements(payload->'rows') x where x->>'rarity_id'=rid::text)<>counts[i] then raise exception 'Incorrect card count for %',key;end if;
    if (select count(*) from jsonb_array_elements(payload->'rows') x join idols a on a.id=(x->>'idol_id')::uuid where x->>'rarity_id'=rid::text and a.gender='female')<>counts[i]/2 or
       (select count(*) from jsonb_array_elements(payload->'rows') x join idols a on a.id=(x->>'idol_id')::uuid where x->>'rarity_id'=rid::text and a.gender='male')<>counts[i]/2 then raise exception 'Each rarity requires equal female and male cards';end if;
    insert into pack_rarities values(pid,rid,case when premium then (array['','','Petal','Silk','Royal','Crown'])[i] else key end,counts[i],counts[i]/2,counts[i]/2,weights[i],10000000);
  end loop;
  for row_data in select value from jsonb_array_elements(payload->'rows') loop
    iid=(row_data->>'idol_id')::uuid;
    if iid=any(seen) then raise exception 'An idol may appear only once per planned pack';end if;
    if not exists(select 1 from idols where id=iid and active and gender in ('female','male') and coalesce(game_idol_id,'') not like '%-GROUP') then raise exception 'Artist is not eligible';end if;
    if coalesce(row_data->>'slot','') !~ '^[0-9]{1,3}$' or (row_data->>'slot')::integer not between 1 and target or
       (row_data->>'slot')::integer::text=any(slots) then raise exception 'Invalid or repeated slot';end if;
    if nullif(row_data->>'image_asset_id','') is not null and row_data->>'image_asset_id' !~ '^[0-9]{1,16}$' then raise exception 'Invalid image asset ID';end if;
    seen=array_append(seen,iid);slots=array_append(slots,(row_data->>'slot')::integer::text);
    gid=null;select group_id into gid from group_memberships where idol_id=iid and membership_status='current' order by id limit 1;
    perform save_card(jsonb_build_object('pack_id',pid,'rarity_id',row_data->>'rarity_id','slot',row_data->>'slot','group_id',gid,
      'pic_status',case when nullif(row_data->>'image_asset_id','') is null then 'To Find' else 'Selected' end,
      'image_asset_id',nullif(row_data->>'image_asset_id',''),'catalog_status','Draft',
      'premium_tier',case when premium then (select display_name from pack_rarities where pack_id=pid and rarity_id=(row_data->>'rarity_id')::uuid) else null end,
      'idol_ids',jsonb_build_array(iid)));
  end loop;
  return pid;
end $draft$;
