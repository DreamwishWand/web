-- Public Community read RPCs remain SECURITY DEFINER so canonical tables stay non-enumerable.
-- Browser callers must go through the narrowly allowlisted community-public-query Edge Function.
revoke execute on function public.community_get_creator_public_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_creator_public_v1(uuid)
to service_role;

revoke execute on function public.community_get_gallery_public_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_gallery_public_v1(uuid)
to service_role;

revoke execute on function public.community_get_question_public_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_question_public_v1(uuid)
to service_role;

revoke execute on function public.community_get_question_redirect_public_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_question_redirect_public_v1(uuid)
to service_role;

revoke execute on function public.community_get_tip_public_v1(uuid)
from public,anon,authenticated;
grant execute on function public.community_get_tip_public_v1(uuid)
to service_role;

revoke execute on function public.community_search_questions_v1(text,text[],boolean,integer)
from public,anon,authenticated;
grant execute on function public.community_search_questions_v1(text,text[],boolean,integer)
to service_role;
