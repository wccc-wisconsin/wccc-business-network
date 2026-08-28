-- WCCC member portal — post-migration verification.
--
-- Run this in the Supabase SQL Editor AFTER running supabase-schema.sql.
-- It compares the live database against every table and column the app
-- actually reads or writes, and names anything missing.
--
-- Expected result: every row reads "ok". Any row reading "MISSING ..." means
-- supabase-schema.sql hasn't fully applied, and the features backed by that
-- table will fail silently in the app (the member fills in a form, sees a
-- result, and it is never saved).
--
-- This list is generated from supabase-schema.sql, so regenerate it if you
-- add a table or column there.

with expected(table_name, column_name) as (
  values
    ('members', 'id'),
    ('members', 'email'),
    ('members', 'name'),
    ('members', 'business_name'),
    ('members', 'industry'),
    ('members', 'city'),
    ('members', 'journey'),
    ('members', 'created_at'),
    ('members', 'updated_at'),
    ('members', 'last_login_at'),
    ('members', 'membership_tier'),
    ('members', 'membership_expires_at'),
    ('login_events', 'id'),
    ('login_events', 'member_id'),
    ('login_events', 'session_id'),
    ('login_events', 'email'),
    ('login_events', 'user_agent'),
    ('login_events', 'created_at'),
    ('event_registrations', 'id'),
    ('event_registrations', 'member_id'),
    ('event_registrations', 'event_title'),
    ('event_registrations', 'created_at'),
    ('program_enrollments', 'id'),
    ('program_enrollments', 'member_id'),
    ('program_enrollments', 'program_title'),
    ('program_enrollments', 'created_at'),
    ('activities', 'id'),
    ('activities', 'member_id'),
    ('activities', 'type'),
    ('activities', 'title'),
    ('activities', 'detail'),
    ('activities', 'created_at'),
    ('event_attendance', 'id'),
    ('event_attendance', 'member_id'),
    ('event_attendance', 'event_title'),
    ('event_attendance', 'created_at'),
    ('module_step_progress', 'id'),
    ('module_step_progress', 'member_id'),
    ('module_step_progress', 'module_key'),
    ('module_step_progress', 'step_key'),
    ('module_step_progress', 'completed'),
    ('module_step_progress', 'answers'),
    ('module_step_progress', 'updated_at'),
    ('module_summaries', 'id'),
    ('module_summaries', 'member_id'),
    ('module_summaries', 'module_key'),
    ('module_summaries', 'title'),
    ('module_summaries', 'content'),
    ('module_summaries', 'created_at'),
    ('module_summaries', 'updated_at'),
    ('member_opportunities', 'id'),
    ('member_opportunities', 'member_id'),
    ('member_opportunities', 'content'),
    ('member_opportunities', 'generated_at'),
    ('business_assessments', 'id'),
    ('business_assessments', 'member_id'),
    ('business_assessments', 'answers'),
    ('business_assessments', 'score'),
    ('business_assessments', 'stage'),
    ('business_assessments', 'free_module_key'),
    ('business_assessments', 'created_at'),
    ('business_assessments', 'updated_at'),
    ('member_decisions', 'id'),
    ('member_decisions', 'member_id'),
    ('member_decisions', 'topic'),
    ('member_decisions', 'transcript'),
    ('member_decisions', 'brief'),
    ('member_decisions', 'created_at'),
    ('member_documents', 'id'),
    ('member_documents', 'member_id'),
    ('member_documents', 'module_key'),
    ('member_documents', 'tool_key'),
    ('member_documents', 'title'),
    ('member_documents', 'content'),
    ('member_documents', 'created_at'),
    ('member_facts', 'id'),
    ('member_facts', 'member_id'),
    ('member_facts', 'fact_key'),
    ('member_facts', 'value'),
    ('member_facts', 'source'),
    ('member_facts', 'source_label'),
    ('member_facts', 'updated_at'),
    ('member_facts', 'confirmed_at'),
    ('ai_usage', 'id'),
    ('ai_usage', 'member_id'),
    ('ai_usage', 'route'),
    ('ai_usage', 'created_at'),
    ('ai_usage', 'input_tokens'),
    ('ai_usage', 'output_tokens'),
    ('ai_usage', 'cache_read_tokens'),
    ('ai_usage', 'cache_write_tokens'),
    ('grants_cache', 'keyword'),
    ('grants_cache', 'grants'),
    ('grants_cache', 'fetched_at'),
    ('conversations', 'id'),
    ('conversations', 'member_id'),
    ('conversations', 'surface'),
    ('conversations', 'module_key'),
    ('conversations', 'transcript'),
    ('conversations', 'created_at'),
    ('conversations', 'updated_at')
)
select
  e.table_name,
  count(*)                                        as expected_columns,
  count(c.column_name)                            as found_columns,
  case
    when count(*) = count(c.column_name) then 'ok'
    when count(c.column_name) = 0        then 'MISSING TABLE'
    else 'MISSING ' || string_agg(e.column_name, ', ')
                         filter (where c.column_name is null)
  end                                             as status
from expected e
left join information_schema.columns c
  on  c.table_schema = 'public'
  and c.table_name   = e.table_name
  and c.column_name  = e.column_name
group by e.table_name
order by
  case when count(*) = count(c.column_name) then 1 else 0 end,
  e.table_name;

-- ---------------------------------------------------------------------------
-- Second check: Row Level Security is on for every table.
--
-- Run this as a separate query. Every row should read 'ok — protected'.
-- Anything reading 'RLS OFF' is reachable by anyone holding the project's
-- anon key, which Supabase treats as publishable. The app is unaffected
-- either way, because it connects with the service role key, which bypasses
-- RLS — so this will not show up as a bug, only as an exposure.
-- ---------------------------------------------------------------------------

select
  c.relname as table_name,
  case when c.relrowsecurity then 'ok — protected' else 'RLS OFF' end as status,
  (select count(*) from pg_policies p
    where p.schemaname = 'public' and p.tablename = c.relname) as policies
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
order by c.relrowsecurity, c.relname;
