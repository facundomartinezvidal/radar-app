-- HU-17 hotfix: re-grant EXECUTE on is_group_member to authenticated.
-- The previous revoke (20260608013250) broke RLS: expenses/groups/group_members
-- policies CALL is_group_member, and Postgres checks EXECUTE on the *calling*
-- role (authenticated) even for SECURITY DEFINER functions. Without it, every
-- query on those tables returned 403 (permission denied for function).
-- The resulting advisor lint (authenticated_security_definer_function_executable)
-- is an accepted false positive: this is a pure boolean membership helper used by RLS.
grant execute on function public.is_group_member(uuid, uuid) to authenticated;
