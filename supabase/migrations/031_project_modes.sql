alter table public.projects
  add column if not exists mode text;

update public.projects
set mode = 'normal'
where mode is null;

update public.projects p
set mode = 'memo'
where p.status = 'completed'
  and not exists (
    select 1
    from public.tasks t
    where t.project_id = p.id
  );

alter table public.projects
  alter column mode set default 'memo',
  alter column mode set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'projects_mode_check'
      and conrelid = 'public.projects'::regclass
  ) then
    alter table public.projects
      add constraint projects_mode_check check (mode in ('memo', 'normal', 'full'));
  end if;
end $$;

create index if not exists projects_mode_idx on public.projects (mode);
