-- Optional project subfolder that a workflow files its output into. When null,
-- generated and copied documents stay at the project root (current behavior).
alter table public.workflows
  add column if not exists output_folder_name text;
