-- EmosiCare schema + keselamatan (jalankan di Supabase > SQL Editor)
create extension if not exists pgcrypto;
create type emotion_t as enum ('gembira','tenang','biasa','risau','sedih','marah');

create table school_classes(name text primary key, year int not null);
insert into school_classes values
('1 GALAXY',1),('1 STELLAR',1),('1 ZENITH',1),('2 GALAXY',2),('2 STELLAR',2),('2 ZENITH',2),
('3 GALAXY',3),('3 STELLAR',3),('3 ZENITH',3),('4 GALAXY',4),('4 STELLAR',4),('4 ORION',4),('4 ZENITH',4),
('5 GALAXY',5),('5 STELLAR',5),('5 ORION',5),('5 ZENITH',5),('6 GALAXY',6),('6 STELLAR',6),('6 ZENITH',6);

create table students(id uuid primary key default gen_random_uuid(), name text not null,
  class text not null references school_classes(name), is_active boolean not null default true,
  created_at timestamptz default now(), updated_at timestamptz default now());
create index on students(class) where is_active;
create index on students using gin (to_tsvector('simple', name));

create table user_profiles(id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users on delete cascade, username text unique not null,
  role text not null check (role in ('teacher','gbk','admin')), created_at timestamptz default now());

create table emotion_checkins(id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id), emotion emotion_t not null,
  checkin_date date not null default (now() at time zone 'Asia/Kuala_Lumpur')::date,
  submitted_at timestamptz default now(), recorded_by uuid references auth.users,
  created_at timestamptz default now(), updated_at timestamptz default now(),
  unique (student_id, checkin_date));
create index on emotion_checkins(checkin_date, emotion);
create index on emotion_checkins(student_id, checkin_date desc);

create table referral_alerts(id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id), alert_date date not null, sad_streak int not null default 3,
  status text not null default 'Baharu' check (status in ('Baharu','Dalam Pemantauan','Tindakan Susulan','Selesai')),
  handled_by uuid references auth.users, action_notes text, created_at timestamptz default now(), updated_at timestamptz default now());
create index on referral_alerts(status, alert_date desc);

create table school_calendar(calendar_date date primary key, is_school_day boolean not null, description text);
create table audit_logs(id bigserial primary key, user_id uuid, action text, table_name text, record_id text, "timestamp" timestamptz default now());

-- Hari persekolahan: kalendar dahulu; jika tiada, Ahad-Khamis (Kelantan). Tukar 0 and 4 kepada 1 and 5 jika Isnin-Jumaat.
create function is_school_day(d date) returns boolean language sql stable as $$
  select coalesce((select is_school_day from school_calendar where calendar_date=d), extract(dow from d) between 0 and 4) $$;

create function app_role() returns text language sql stable security definer set search_path=public as $$
  select role from user_profiles where auth_user_id=auth.uid() $$;

-- RLS
alter table school_classes enable row level security; alter table students enable row level security;
alter table user_profiles enable row level security; alter table emotion_checkins enable row level security;
alter table referral_alerts enable row level security; alter table school_calendar enable row level security;
alter table audit_logs enable row level security;
revoke all on all tables in schema public from anon, authenticated;
grant select on school_classes, school_calendar, user_profiles to authenticated;
grant select, insert, update on students to authenticated;
grant select on emotion_checkins, audit_logs to authenticated;
grant select, update on referral_alerts to authenticated;
grant insert, update, delete on school_calendar to authenticated;

create policy cls_r on school_classes for select to authenticated using (true);
create policy cal_r on school_calendar for select to authenticated using (true);
create policy cal_w on school_calendar for all to authenticated using (app_role()='gbk') with check (app_role()='gbk');
create policy prof_r on user_profiles for select to authenticated using (auth_user_id=auth.uid());
create policy stu_r on students for select to authenticated using (app_role() in ('teacher','gbk'));
create policy stu_w on students for insert to authenticated with check (app_role()='gbk');
create policy stu_u on students for update to authenticated using (app_role()='gbk') with check (app_role()='gbk');
create policy emo_gbk on emotion_checkins for select to authenticated using (app_role()='gbk'); -- guru/admin: tiada akses
create policy alert_r on referral_alerts for select to authenticated using (app_role()='gbk');
create policy alert_u on referral_alerts for update to authenticated using (app_role()='gbk') with check (app_role()='gbk');
create policy audit_r on audit_logs for select to authenticated using (app_role()='gbk');

-- Check-in selamat (hanya pulang status, bukan emoji)
create function submit_checkin(p_student uuid, p_emotion emotion_t) returns json
language plpgsql security definer set search_path=public as $$
declare n int; begin
  if app_role() not in ('teacher','gbk') then raise exception 'Tidak dibenarkan'; end if;
  if not exists(select 1 from students where id=p_student and is_active) then return json_build_object('success',false,'message','MURID TIDAK AKTIF'); end if;
  insert into emotion_checkins(student_id,emotion,recorded_by) values (p_student,p_emotion,auth.uid()) on conflict (student_id,checkin_date) do nothing;
  get diagnostics n = row_count;
  if n=0 then return json_build_object('success',false,'message','MURID SUDAH CHECK-IN HARI INI'); end if;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),'CHECKIN','emotion_checkins',p_student::text);
  return json_build_object('success',true,'message','CHECK-IN BERJAYA'); end $$;

-- Pengesanan sedih 3 hari persekolahan berturut-turut
create function detect_sad_streak() returns trigger language plpgsql security definer set search_path=public as $$
declare days date[]; c int; begin
  select array_agg(d order by d desc) into days from (select d::date d from generate_series(new.checkin_date-30, new.checkin_date, '1 day') d
    where is_school_day(d::date) order by d desc limit 3) x;
  if array_length(days,1)=3 and new.checkin_date=days[1] then
    select count(*) into c from emotion_checkins where student_id=new.student_id and emotion='sedih' and checkin_date=any(days);
    if c=3 and not exists(select 1 from referral_alerts where student_id=new.student_id and alert_date>=days[3]) then
      insert into referral_alerts(student_id,alert_date) values (new.student_id,new.checkin_date); end if; end if;
  return new; end $$;
create trigger trg_sad after insert on emotion_checkins for each row when (new.emotion='sedih') execute function detect_sad_streak();

-- View/fungsi guru: tiada emoji
create function teacher_checkin_status(p_date date, p_class text default null, p_search text default null, p_limit int default 50, p_offset int default 0)
returns table(student_id uuid, name text, class text, checkin_date date, status text) language sql stable security definer set search_path=public as $$
  select s.id, s.name, s.class, p_date, case when c.id is null then 'Belum' else 'Sudah' end
  from students s left join emotion_checkins c on c.student_id=s.id and c.checkin_date=p_date
  where app_role() in ('teacher','gbk') and s.is_active and (p_class is null or s.class=p_class)
    and (p_search is null or s.name ilike '%'||p_search||'%')
  order by s.class, s.name limit least(p_limit,100) offset p_offset $$;

create function participation_summary(p_date date) returns table(total int, done int, pending int)
language sql stable security definer set search_path=public as $$
  select t.n, d.n, t.n-d.n from (select count(*)::int n from students where is_active) t,
   (select count(*)::int n from emotion_checkins c join students s on s.id=c.student_id where c.checkin_date=p_date and s.is_active) d
  where app_role() in ('teacher','gbk','admin') $$;

-- Agregat sahaja (GBK & Pentadbir)
create function emotion_summary(p_from date, p_to date) returns table(class text, emotion emotion_t, total bigint)
language sql stable security definer set search_path=public as $$
  select s.class, c.emotion, count(*) from emotion_checkins c join students s on s.id=c.student_id
  where c.checkin_date between p_from and p_to and app_role() in ('gbk','admin') group by 1,2 $$;

create function emotion_trend(p_from date, p_to date) returns table(day date, emotion emotion_t, total bigint)
language sql stable security definer set search_path=public as $$
  select checkin_date, emotion, count(*) from emotion_checkins
  where checkin_date between p_from and p_to and app_role() in ('gbk','admin') group by 1,2 order by 1 $$;

revoke execute on all functions in schema public from public, anon;
grant execute on function submit_checkin, teacher_checkin_status, participation_summary, emotion_summary, emotion_trend, is_school_day, app_role to authenticated;

-- LANGKAH AKAUN: Supabase > Authentication > Users > Add user (Auto confirm):
-- guru@emosicare.sk / gbksktk@emosicare.sk / admin@emosicare.sk  (kata laluan awal dari dokumen; WAJIB tukar sebelum rasmi). Kemudian:
insert into user_profiles(auth_user_id, username, role)
select id, split_part(email,'@',1), case split_part(email,'@',1) when 'guru' then 'teacher' when 'gbksktk' then 'gbk' else 'admin' end
from auth.users where email in ('guru@emosicare.sk','gbksktk@emosicare.sk','admin@emosicare.sk') on conflict do nothing;
