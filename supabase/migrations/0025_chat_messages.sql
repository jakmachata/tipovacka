-- Iter 153: Chat messages table for the homepage chat box.
-- SELECT for any authenticated user; INSERT only for admins + approved+!rejected players.
-- No update/delete from clients (admin can purge via service client if needed).

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (length(trim(content)) > 0 AND length(content) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON public.chat_messages (created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_select_auth" ON public.chat_messages;
CREATE POLICY "chat_select_auth" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "chat_insert_approved" ON public.chat_messages;
CREATE POLICY "chat_insert_approved" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true
             OR (p.is_approved = true AND COALESCE(p.is_rejected, false) = false))
    )
  );

-- Enable realtime broadcast for this table so the Chat client component
-- gets live INSERTs via Supabase Realtime.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
