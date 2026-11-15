-- Naik kelas + prestasi data berskala. Jalankan selepas 001 & 002.

-- 1) Simpan kelas semasa check-in supaya statistik tahun lepas kekal tepat selepas murid naik kelas
alter table emotion_checkins add column if not exists class_name text;
update emotion_checkins c set class_name = s.class from students s where s.id = c.student_id and c.class_name is null;
alter table emotion_checkins alter column class_name set not null;
drop index if exists emotion_checkins_checkin_date_emotion_idx;
create index if not exists emo_date_class_emotion on emotion_checkins(checkin_date, class_name, emotion);

create or replace function submit_checkin(p_student uuid, p_emotion emotion_t) returns json
language plpgsql security definer set search_path=public as $$
declare n int; v_class text; begin
  if app_role() not in ('teacher','gbk') then raise exception 'Tidak dibenarkan'; end if;
  select class into v_class from students where id=p_student and is_active;
  if v_class is null then return json_build_object('success',false,'message','MURID TIDAK AKTIF'); end if;
  insert into emotion_checkins(student_id,emotion,recorded_by,class_name) values (p_student,p_emotion,auth.uid(),v_class)
    on conflict (student_id,checkin_date) do nothing;
  get diagnostics n = row_count;
  if n=0 then return json_build_object('success',false,'message','MURID SUDAH CHECK-IN HARI INI'); end if;
  return json_build_object('success',true,'message','CHECK-IN BERJAYA'); end $$;
-- (audit check-in harian tidak ditulis setiap kali untuk elak 800 baris tambahan sehari; rekod ada pada recorded_by + submitted_at)

create or replace function emotion_summary(p_from date, p_to date) returns table(class text, emotion emotion_t, total bigint)
language sql stable security definer set search_path=public as $$
  select class_name, emotion, count(*) from emotion_checkins
  where checkin_date between p_from and p_to and app_role() in ('gbk','admin') group by 1,2 $$;

-- 2) Naik kelas
create table promotion_batches(id uuid primary key default gen_random_uuid(), performed_by uuid references auth.users,
  performed_at timestamptz not null default now(), moved int default 0, graduated int default 0, undone boolean not null default false);
create table promotion_log(batch_id uuid references promotion_batches on delete cascade, student_id uuid references students on delete cascade,
  old_class text not null, old_active boolean not null, new_class text not null, new_active boolean not null, primary key(batch_id, student_id));
alter table promotion_batches enable row level security; alter table promotion_log enable row level security;
revoke all on promotion_batches, promotion_log from anon, authenticated;
grant select on promotion_batches to authenticated;
create policy pb_r on promotion_batches for select to authenticated using (app_role()='gbk');

create function class_counts() returns table(class text, total int) language sql stable security definer set search_path=public as $$
  select c.name, count(s.id) filter (where s.is_active)::int from school_classes c left join students s on s.class=c.name
  where app_role()='gbk' group by c.name order by c.name $$;

-- p_mapping: [{"from":"1 GALAXY","to":"2 GALAXY"},{"from":"6 ZENITH","to":null}]  (to = null → tamat persekolahan, dinyahaktifkan)
create function promote_students(p_mapping jsonb) returns json language plpgsql security definer set search_path=public as $$
declare b uuid; mv int; gr int; begin
  if app_role()<>'gbk' then raise exception 'Tidak dibenarkan'; end if;
  if p_mapping is null or jsonb_array_length(p_mapping)=0 then return json_build_object('success',false,'message','TIADA KELAS DIPILIH'); end if;
  if exists(select 1 from promotion_batches where not undone and performed_at > now()-interval '180 days') then
    return json_build_object('success',false,'message','NAIK KELAS TELAH DILAKUKAN DALAM 180 HARI LEPAS. BATALKAN DAHULU JIKA TERSILAP.'); end if;
  if (select count(*) from jsonb_array_elements(p_mapping)) <> (select count(distinct x->>'from') from jsonb_array_elements(p_mapping) x) then
    return json_build_object('success',false,'message','KELAS ASAL BERULANG DALAM SENARAI'); end if;
  if exists(select 1 from jsonb_array_elements(p_mapping) x where not exists(select 1 from school_classes where name=x->>'from')
     or (x->>'to' is not null and not exists(select 1 from school_classes where name=x->>'to'))) then
    return json_build_object('success',false,'message','KELAS TIDAK SAH DALAM SENARAI'); end if;
  insert into promotion_batches(performed_by) values (auth.uid()) returning id into b;
  insert into promotion_log
    select b, s.id, s.class, s.is_active, coalesce(m.t, s.class), m.t is not null
    from students s join (select x->>'from' f, x->>'to' t from jsonb_array_elements(p_mapping) x) m on m.f=s.class where s.is_active;
  update students s set class=l.new_class, is_active=l.new_active, updated_at=now()
    from promotion_log l where l.batch_id=b and l.student_id=s.id;
  select count(*) filter (where new_active), count(*) filter (where not new_active) into mv, gr from promotion_log where batch_id=b;
  update promotion_batches set moved=mv, graduated=gr where id=b;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),'NAIK_KELAS','promotion_batches',b::text);
  return json_build_object('success',true,'message',format('%s MURID NAIK KELAS, %s MURID TAMAT PERSEKOLAHAN',mv,gr)); end $$;

create function undo_last_promotion() returns json language plpgsql security definer set search_path=public as $$
declare b uuid; n int; begin
  if app_role()<>'gbk' then raise exception 'Tidak dibenarkan'; end if;
  select id into b from promotion_batches where not undone order by performed_at desc limit 1;
  if b is null then return json_build_object('success',false,'message','TIADA NAIK KELAS UNTUK DIBATALKAN'); end if;
  update students s set class=l.old_class, is_active=l.old_active, updated_at=now() from promotion_log l
    where l.batch_id=b and l.student_id=s.id and s.class=l.new_class and s.is_active=l.new_active;
  get diagnostics n = row_count;
  update promotion_batches set undone=true where id=b;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),'BATAL_NAIK_KELAS','promotion_batches',b::text);
  return json_build_object('success',true,'message',format('%s MURID DIKEMBALIKAN KE KELAS ASAL',n)); end $$;

revoke execute on function class_counts, promote_students, undo_last_promotion from public, anon;
grant execute on function class_counts, promote_students, undo_last_promotion to authenticated;
