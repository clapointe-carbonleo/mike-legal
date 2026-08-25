-- Drop the pre-user_api_keys inline key columns. Nothing in the backend reads
-- them any more (keys moved to public.user_api_keys) and they hold no rows.
alter table public.user_profiles
  drop column if exists claude_api_key;

alter table public.user_profiles
  drop column if exists gemini_api_key;
