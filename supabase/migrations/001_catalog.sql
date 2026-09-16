-- Run once in a new Supabase project's SQL editor. No service key is used by the app.
create extension if not exists pgcrypto;
create table public.profiles (id uuid primary key references auth.users on delete cascade, role text not null check(role in ('admin','moderator')));
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role in ('admin','moderator')) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from profiles where id=auth.uid() and role='admin') $$;
create function public.norm(v text) returns text language sql immutable as $$ select lower(trim(regexp_replace(normalize(coalesce(v,''),NFKC),'\s+',' ','g'))) $$;
create table public.groups (id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 200),normalized_name text generated always as (public.norm(name)) stored unique,status text not null default 'active' check(status in ('active','inactive','disbanded')),roster_configured boolean not null default false,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table public.idols (id uuid primary key default gen_random_uuid(),stage_name text not null check(length(trim(stage_name)) between 1 and 200),normalized_name text generated always as (public.norm(stage_name)) stored,gender text not null default 'unknown' check(gender in ('female','male','other','unknown')),active boolean not null default true,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index idols_name_idx on public.idols(normalized_name);
create table public.group_memberships (id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups on delete cascade,idol_id uuid not null references public.idols on delete restrict,membership_status text not null default 'current' check(membership_status in ('current','former')),created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(group_id,idol_id));
create index membership_idol_idx on public.group_memberships(idol_id);
create table public.packs (id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 200),normalized_name text generated always as (public.norm(name)) stored unique,pack_type text not null check(length(trim(pack_type)) between 1 and 100),pack_number integer check(pack_number>=0),release_date date,status text not null default 'draft' check(status in ('planning','draft','ready','released','archived')),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index packs_status_idx on public.packs(status);
create table public.rarities (id uuid primary key default gen_random_uuid(),label text not null check(length(trim(label)) between 1 and 100),numeric_value numeric not null unique check(numeric_value between 0 and 100),sort_order integer not null default 0,active boolean not null default true);
insert into public.rarities(label,numeric_value,sort_order) values ('5.00%',5,0),('2.50%',2.5,1),('1.20%',1.2,2),('0.67%',0.67,3),('0.23%',0.23,4),('0.05%',0.05,5);
create table public.cards (id uuid primary key default gen_random_uuid(),pack_id uuid not null references public.packs on delete restrict,rarity_id uuid not null references public.rarities on delete restrict,slot text,card_name text,group_id uuid references public.groups on delete restrict,pic_status text,source_url text check(source_url is null or source_url='' or source_url ~* '^https?://[^[:space:]]+$'),notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now());
create index cards_pack_idx on public.cards(pack_id);
create index cards_group_idx on public.cards(group_id);
create index cards_rarity_idx on public.cards(rarity_id);
create table public.card_idols (card_id uuid not null references public.cards on delete cascade,idol_id uuid not null references public.idols on delete restrict,primary key(card_id,idol_id));
create index card_idols_idol_idx on public.card_idols(idol_id);
create table public.import_history(id uuid primary key default gen_random_uuid(),filename text not null,imported_at timestamptz not null default now(),imported_by uuid not null default auth.uid() references auth.users,rows_processed integer not null,rows_created integer not null,rows_skipped integer not null,warnings jsonb not null default '[]');
create table public.settings(id boolean primary key default true check(id),include_unreleased boolean not null default false);
insert into public.settings(id) values(true);
create function public.touch_updated() returns trigger language plpgsql as $$ begin new.updated_at=now();return new;end $$;
do $$ declare t text;begin
foreach t in array array['groups','idols','group_memberships','packs','cards'] loop execute format('create trigger touch_updated before update on public.%I for each row execute function public.touch_updated()',t);end loop;
foreach t in array array['groups','idols','group_memberships','packs','cards','card_idols','import_history'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy staff_access on public.%I for all to authenticated using(public.is_staff()) with check(public.is_staff())',t);
end loop;
foreach t in array array['rarities','settings','profiles'] loop
execute format('alter table public.%I enable row level security',t);
execute format('create policy staff_read on public.%I for select to authenticated using(public.is_staff())',t);
execute format('create policy admin_write on public.%I for all to authenticated using(public.is_admin()) with check(public.is_admin())',t);
end loop;
end $$;
-- Functions use the caller's RLS permissions. Serialize catalog mutations so
-- two simultaneous imports cannot create duplicate artists/cards.
create function public.resolve_artist(artist text, group_name text, sex text) returns uuid language plpgsql security invoker set search_path=public as $$
declare gid uuid;iid uuid;cleaned_group text:=trim(coalesce(group_name,''));
begin
 if not is_staff() then raise exception 'Moderator access required';end if;
 perform pg_advisory_xact_lock(725193);
 if norm(artist)='' then raise exception 'Idol is required';end if;
 if norm(cleaned_group) in ('solo','soloist') then cleaned_group:='';end if;
 if norm(cleaned_group)<>'' then
   insert into groups(name) values(cleaned_group) on conflict(normalized_name) do nothing;
   select id into gid from groups where normalized_name=norm(cleaned_group);
   select i.id into iid from idols i join group_memberships m on m.idol_id=i.id
   where m.group_id=gid and i.normalized_name=norm(artist)
   order by i.created_at,i.id limit 1;
   if iid is null then
     insert into idols(stage_name,gender) values(trim(artist),coalesce(nullif(norm(sex),''),'unknown')) returning id into iid;
     insert into group_memberships(group_id,idol_id) values(gid,iid) on conflict(group_id,idol_id) do nothing;
   end if;
 else
   select i.id into iid from idols i where i.normalized_name=norm(artist)
     and not exists(select 1 from group_memberships m where m.idol_id=i.id)
   order by i.created_at,i.id limit 1;
   if iid is null then
     insert into idols(stage_name,gender) values(trim(artist),coalesce(nullif(norm(sex),''),'unknown')) returning id into iid;
   end if;
 end if;
 return iid;
end $$;
create function public.prevent_duplicate_group_stage_name() returns trigger language plpgsql security invoker set search_path=public as $$
declare incoming_name text;
begin
 select normalized_name into incoming_name from idols where id=new.idol_id;
 if exists(select 1 from group_memberships m join idols i on i.id=m.idol_id where m.group_id=new.group_id and m.idol_id<>new.idol_id and i.normalized_name=incoming_name) then
   raise exception 'This group already has an idol with stage name %. Reuse the existing idol instead.',(select stage_name from idols where id=new.idol_id);
 end if;
 return new;
end $$;
create trigger prevent_duplicate_group_stage_name before insert or update of group_id,idol_id on public.group_memberships for each row execute function public.prevent_duplicate_group_stage_name();
create function public.save_card(payload jsonb) returns uuid language plpgsql security invoker set search_path=public as $$
declare cid uuid; ids uuid[];pid uuid;rid uuid;slot_value text;
begin
 if not is_staff() then raise exception 'Moderator access required';end if;
 perform pg_advisory_xact_lock(725193);
 cid=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());pid=(payload->>'pack_id')::uuid;rid=(payload->>'rarity_id')::uuid;slot_value=nullif(payload->>'slot','');
 select coalesce(array_agg(distinct value::uuid order by value::uuid),'{}'::uuid[]) into ids from jsonb_array_elements_text(coalesce(payload->'idol_ids','[]'));
 if cardinality(ids)=0 and nullif(payload->>'group_id','') is null then raise exception 'Choose an idol or group';end if;
 if exists(select 1 from cards c where c.id<>cid and c.pack_id=pid and c.rarity_id=rid and norm(c.slot)=norm(slot_value) and c.group_id is not distinct from nullif(payload->>'group_id','')::uuid and coalesce((select array_agg(ci.idol_id order by ci.idol_id) from card_idols ci where ci.card_id=c.id),'{}'::uuid[])=ids) then raise exception 'An exact duplicate card already exists';end if;
 insert into cards(id,pack_id,rarity_id,slot,card_name,group_id,pic_status,source_url,notes) values(cid,pid,rid,slot_value,nullif(payload->>'card_name',''),nullif(payload->>'group_id','')::uuid,nullif(payload->>'pic_status',''),nullif(payload->>'source_url',''),nullif(payload->>'notes',''))
 on conflict(id) do update set pack_id=excluded.pack_id,rarity_id=excluded.rarity_id,slot=excluded.slot,card_name=excluded.card_name,group_id=excluded.group_id,pic_status=excluded.pic_status,source_url=excluded.source_url,notes=excluded.notes;
 delete from card_idols where card_id=cid;
 insert into card_idols(card_id,idol_id) select cid,unnest(ids);
 return cid;
end $$;
create function public.commit_import(payload jsonb) returns jsonb language plpgsql security invoker set search_path=public as $$
declare r jsonb;gid uuid;iid uuid;pid uuid;rid uuid;cid uuid;made integer=0;skipped integer=0;mode text;gname text;selected uuid[];warnings jsonb='[]'; existing_count integer;
begin
 if not is_staff() then raise exception 'Moderator access required';end if;
 perform pg_advisory_xact_lock(725193);
 mode=payload->>'mode';
 if mode not in ('cards','roster') then raise exception 'Invalid import mode';end if;
 if jsonb_array_length(payload->'rows')>10000 then raise exception 'Limit is 10,000 rows per import';end if;
 if mode='roster' then
  for gname in select distinct value->>'group' from jsonb_array_elements(payload->'rows') loop
   if norm(gname)='' then raise exception 'Group is required';end if;
   selected='{}';
   for r in select value from jsonb_array_elements(payload->'rows') where norm(value->>'group')=norm(gname) loop
    iid=resolve_artist(r->>'idol',gname,r->>'gender');
    select id into gid from groups where normalized_name=norm(gname);
    update group_memberships set membership_status=coalesce(nullif(r->>'membership_status',''),'current') where group_id=gid and idol_id=iid;
    selected=array_append(selected,iid);made=made+1;
   end loop;
   update group_memberships set membership_status='former' where group_id=gid and not(idol_id=any(selected));
   if not exists(select 1 from group_memberships where group_id=gid and membership_status='current') then raise exception 'A configured roster needs at least one current member';end if;
   update groups set roster_configured=true where id=gid;
  end loop;
 else
  for r in select value from jsonb_array_elements(payload->'rows') loop
   iid=resolve_artist(r->>'idol',r->>'group',r->>'gender');
   gid=null;select id into gid from groups where normalized_name=norm(r->>'group');
   insert into packs(name,pack_type,pack_number) values(r->>'sheet',coalesce(nullif(regexp_replace(r->>'sheet','\s+[0-9]+$',''),''),r->>'sheet'),substring(r->>'sheet' from '\s+([0-9]+)$')::integer) on conflict(normalized_name) do nothing;
   select id into pid from packs where normalized_name=norm(r->>'sheet');
   select id into rid from rarities where numeric_value=(r->>'rarityValue')::numeric and active;
   if rid is null then raise exception 'Unknown or inactive rarity';end if;
   select count(*) into existing_count from cards c where c.pack_id=pid and c.rarity_id=rid and norm(c.slot)=norm(r->>'slot') and (select count(*) from card_idols ci where ci.card_id=c.id)=1 and exists(select 1 from card_idols ci where ci.card_id=c.id and ci.idol_id=iid);
   if existing_count>0 then skipped=skipped+1;continue;end if;
   cid=save_card(jsonb_build_object('pack_id',pid,'rarity_id',rid,'slot',r->>'slot','group_id',gid,'pic_status',r->>'pic_status','source_url',r->>'source_url','notes',r->>'notes','idol_ids',jsonb_build_array(iid)));
   made=made+1;
  end loop;
 end if;
 warnings=coalesce(payload->'warnings','[]');
 insert into import_history(filename,rows_processed,rows_created,rows_skipped,warnings) values(left(payload->>'filename',255),coalesce((payload->>'processed')::integer,jsonb_array_length(payload->'rows')),made,skipped+coalesce((payload->>'skipped')::integer,0),warnings);
 return jsonb_build_object('created',made,'skipped',skipped);
end $$;
-- Explicit grants: public/anon cannot invoke mutations or access catalog data.
revoke all on all tables in schema public from anon;
grant select,insert,update,delete on all tables in schema public to authenticated;
revoke all on function public.resolve_artist(text,text,text),public.save_card(jsonb),public.commit_import(jsonb) from public,anon;
grant execute on function public.resolve_artist(text,text,text),public.save_card(jsonb),public.commit_import(jsonb) to authenticated;
