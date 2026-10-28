CREATE TABLE public.account_credentials (
 user_id uuid PRIMARY KEY,
 username text NOT NULL UNIQUE,
 recovery_email text,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_credentials TO service_role;
ALTER TABLE public.account_credentials ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_recovery_codes (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL,
 code_hash text NOT NULL UNIQUE,
 used_at timestamptz,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_recovery_codes TO service_role;
ALTER TABLE public.account_recovery_codes ENABLE ROW LEVEL SECURITY;
CREATE TABLE public.account_rate_limits (
 key text PRIMARY KEY,
 attempts integer NOT NULL DEFAULT 0,
 window_start timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.account_rate_limits TO service_role;
ALTER TABLE public.account_rate_limits ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.check_account_rate_limit(p_key text, p_limit integer)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
 INSERT INTO public.account_rate_limits AS limits (key, attempts, window_start) VALUES (p_key, 1, now())
 ON CONFLICT (key) DO UPDATE SET attempts = CASE WHEN limits.window_start < now() - interval '1 hour' THEN 1 ELSE limits.attempts + 1 END,
 window_start = CASE WHEN limits.window_start < now() - interval '1 hour' THEN now() ELSE limits.window_start END
 RETURNING attempts INTO n;
 RETURN n <= p_limit;
END; $$;
REVOKE ALL ON FUNCTION public.check_account_rate_limit(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_account_rate_limit(text, integer) TO service_role;
CREATE OR REPLACE FUNCTION public.consume_account_recovery_code(p_user_id uuid, p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE consumed uuid;
BEGIN
 UPDATE public.account_recovery_codes SET used_at = now() WHERE user_id = p_user_id AND code_hash = p_hash AND used_at IS NULL RETURNING id INTO consumed;
 RETURN consumed IS NOT NULL;
END; $$;
REVOKE ALL ON FUNCTION public.consume_account_recovery_code(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_account_recovery_code(uuid, text) TO service_role;
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
 INSERT INTO public.profiles (id, username) VALUES (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))) ON CONFLICT (id) DO NOTHING;
 INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user') ON CONFLICT DO NOTHING;
 RETURN new;
END; $$;
CREATE TRIGGER on_streamly_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_audio text NOT NULL DEFAULT 'sub';
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS spoiler boolean NOT NULL DEFAULT false;
CREATE TABLE public.anime_comments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 anilist_id integer NOT NULL,
 episode integer NOT NULL,
 user_id uuid NOT NULL,
 body text NOT NULL,
 spoiler boolean NOT NULL DEFAULT false,
 created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.anime_comments TO anon;
GRANT SELECT, INSERT, DELETE ON public.anime_comments TO authenticated;
GRANT ALL ON public.anime_comments TO service_role;
ALTER TABLE public.anime_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read anime comments" ON public.anime_comments FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Post own anime comments" ON public.anime_comments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND length(body) BETWEEN 1 AND 2000 AND episode > 0 AND anilist_id > 0);
CREATE POLICY "Delete own anime comments" ON public.anime_comments FOR DELETE TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));