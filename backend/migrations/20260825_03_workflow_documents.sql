-- Reference/template documents carried by a workflow.
--
-- A workflow's template is owned by its author and lives outside any project,
-- so it is not reachable by users the workflow is shared with. Rather than
-- widening document access, the server copies the template into the running
-- user's project when the workflow is applied; origin_workflow_document_id
-- records where a copy came from so the copy is made only once per project.
create table if not exists public.workflow_documents (
  id uuid primary key default gen_random_uuid(),
  workflow_id uuid not null references public.workflows(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  role text not null default 'template',
  created_at timestamptz not null default now(),
  constraint workflow_documents_workflow_document_unique
    unique(workflow_id, document_id)
);

create index if not exists idx_workflow_documents_workflow
  on public.workflow_documents(workflow_id);

alter table public.documents
  add column if not exists origin_workflow_document_id uuid
    references public.workflow_documents(id) on delete set null;

create index if not exists idx_documents_origin_workflow_document
  on public.documents(project_id, origin_workflow_document_id);

revoke all on public.workflow_documents from anon, authenticated;
