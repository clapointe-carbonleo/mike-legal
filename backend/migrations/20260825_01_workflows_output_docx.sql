-- Assistant workflows can request that their run finish by producing a Word
-- document. The instruction is appended to the workflow prompt at run time.
alter table public.workflows
  add column if not exists output_docx boolean not null default false;
