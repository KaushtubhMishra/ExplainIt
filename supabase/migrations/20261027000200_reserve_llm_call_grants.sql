-- ExplainIt: 20261027000100_remove_brainstorm.sql recreated reserve_llm_call to rebind it to
-- the new llm_kind enum, but a freshly created function defaults to EXECUTE granted to
-- PUBLIC in Postgres, so it missed the revoke/grant pair every other function in this
-- project carries. The function's own "uid is null" check already stopped it doing
-- anything as anon, but the access rule itself needs restoring to match AGENTS.md's pattern.
-- 20261027000100 has already been applied, so this is a new migration rather than an edit
-- to it, per AGENTS.md rule 4 (never edit an applied migration).

revoke execute on function reserve_llm_call(llm_kind, uuid, integer) from public, anon;
grant execute on function reserve_llm_call(llm_kind, uuid, integer) to authenticated;
