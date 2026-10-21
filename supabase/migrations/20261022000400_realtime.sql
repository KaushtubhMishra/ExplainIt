-- ExplainIt V1: let the browser follow its own jobs and videos live (row-level security still applies).
alter publication supabase_realtime add table jobs, videos;
