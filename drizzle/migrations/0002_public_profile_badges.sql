ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS public_avatar_url text, ADD COLUMN IF NOT EXISTS public_display_name text, ADD COLUMN IF NOT EXISTS public_banner_url text;

CREATE TABLE public.profile_badges (
  user_id uuid NOT NULL,
  badge text NOT NULL CHECK (badge IN ('owner','moderator','developer','supporter','gamer','creator','partner','bot')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, badge)
);
GRANT SELECT ON public.profile_badges TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_badges TO authenticated;
GRANT ALL ON public.profile_badges TO service_role;
ALTER TABLE public.profile_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Badges are public" ON public.profile_badges FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage badges" ON public.profile_badges FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_public_admin(profile_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.has_role(profile_user_id, 'admin') $$;
GRANT EXECUTE ON FUNCTION public.is_public_admin(uuid) TO anon, authenticated;