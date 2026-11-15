-- Pengurusan murid (GBK sahaja). Jalankan selepas 001_schema.sql
create function add_student(p_name text, p_class text) returns json
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text := btrim(p_name); begin
  if app_role()<>'gbk' then raise exception 'Tidak dibenarkan'; end if;
  if v_name = '' then return json_build_object('success',false,'message','NAMA MURID WAJIB DIISI'); end if;
  if not exists(select 1 from school_classes where name=p_class) then return json_build_object('success',false,'message','KELAS TIDAK SAH'); end if;
  if exists(select 1 from students where lower(name)=lower(v_name) and class=p_class) then
    return json_build_object('success',false,'message','MURID DENGAN NAMA DAN KELAS YANG SAMA SUDAH WUJUD'); end if;
  insert into students(name,class) values (v_name,p_class) returning id into v_id;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),'TAMBAH_MURID','students',v_id::text);
  return json_build_object('success',true,'message','MURID BERJAYA DITAMBAH'); end $$;

create function set_student_active(p_id uuid, p_active boolean) returns json
language plpgsql security definer set search_path=public as $$ begin
  if app_role()<>'gbk' then raise exception 'Tidak dibenarkan'; end if;
  update students set is_active=p_active, updated_at=now() where id=p_id;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),case when p_active then 'AKTIF_MURID' else 'NYAHAKTIF_MURID' end,'students',p_id::text);
  return json_build_object('success',true,'message',case when p_active then 'MURID DIAKTIFKAN SEMULA' else 'MURID DINYAHAKTIFKAN (SEJARAH EMOSI KEKAL)' end); end $$;

-- PADAM KEKAL: memadam murid beserta semua rekod emosi dan amaran. Tidak boleh dipulihkan.
create function delete_student(p_id uuid) returns json
language plpgsql security definer set search_path=public as $$ begin
  if app_role()<>'gbk' then raise exception 'Tidak dibenarkan'; end if;
  delete from referral_alerts where student_id=p_id;
  delete from emotion_checkins where student_id=p_id;
  delete from students where id=p_id;
  insert into audit_logs(user_id,action,table_name,record_id) values (auth.uid(),'PADAM_MURID','students',p_id::text);
  return json_build_object('success',true,'message','MURID DAN SEMUA REKODNYA TELAH DIPADAM'); end $$;

revoke execute on function add_student, set_student_active, delete_student from public, anon;
grant execute on function add_student, set_student_active, delete_student to authenticated;
