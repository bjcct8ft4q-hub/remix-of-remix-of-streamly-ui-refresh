CREATE TABLE public.status_incidents (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 title text NOT NULL CHECK (length(title) BETWEEN 1 AND 160),
 service text NOT NULL CHECK (length(service) BETWEEN 1 AND 80),
 body text NOT NULL CHECK (length(body) BETWEEN 1 AND 5000),
 status text NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating','identified','monitoring','resolved')),
 severity text NOT NULL DEFAULT 'degraded' CHECK (severity IN ('degraded','outage','maintenance')),
 started_at timestamptz NOT NULL DEFAULT now(),
 resolved_at timestamptz,
 updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.status_incidents TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_incidents TO authenticated;
GRANT ALL ON public.status_incidents TO service_role;
ALTER TABLE public.status_incidents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public incident history" ON public.status_incidents FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admins manage incidents" ON public.status_incidents FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE FUNCTION public.timestamp_status_incident() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
 NEW.updated_at = now();
 IF NEW.status = 'resolved' THEN
  NEW.resolved_at = COALESCE(NEW.resolved_at, now());
 ELSE
  NEW.resolved_at = NULL;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER timestamp_status_incident BEFORE INSERT OR UPDATE ON public.status_incidents FOR EACH ROW EXECUTE FUNCTION public.timestamp_status_incident();