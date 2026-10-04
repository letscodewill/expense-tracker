begin;
create temporary table avatar_test_context(owner_id uuid, other_id uuid);
insert into avatar_test_context select (select id from auth.users order by id limit 1),(select id from auth.users order by id offset 1 limit 1);
grant select on avatar_test_context to authenticated;
select set_config('request.jwt.claim.sub',owner_id::text,true) from avatar_test_context;
set local role authenticated;
do $$
declare own uuid; other_user uuid; denied boolean := false;
begin
  select owner_id,other_id into own,other_user from avatar_test_context;
  insert into storage.objects(bucket_id,name,owner_id) values ('profile-photos',own::text || '/avatar-test.png',own::text);
  if not exists(select 1 from storage.objects where bucket_id='profile-photos' and name=own::text || '/avatar-test.png') then raise exception 'Own read failed'; end if;
  begin
    insert into storage.objects(bucket_id,name,owner_id) values ('profile-photos',other_user::text || '/avatar-test.png',own::text);
  exception when insufficient_privilege then denied:=true;
  end;
  if not denied then raise exception 'Foreign upload allowed'; end if;
end $$;
reset role;
insert into storage.objects(bucket_id,name,owner_id) select 'profile-photos',other_id::text || '/avatar-test.png',other_id::text from avatar_test_context;
set local role authenticated;
do $$ begin
  if exists(select 1 from storage.objects where bucket_id='profile-photos' and name=(select other_id::text || '/avatar-test.png' from avatar_test_context)) then raise exception 'Foreign read allowed'; end if;
end $$;
reset role;
rollback;
select 'PASS: own upload/read, foreign upload/read denied; metadata fixtures rolled back' as result;
