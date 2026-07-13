-- ============================================================================
-- Fix: 404 en REST API
-- ============================================================================
-- Diagnóstico:
--   ✅ check_streak(), get_feed(), find_events_nearby EXISTEN con grants
--   ❌ friendships, messages, event_invites NO EXISTEN (migration-social.sql nunca aplicado)
--   ✅ user_streaks, user_achievements ya existen
--   ⚠️ PostgREST schema cache posiblemente desactualizado
--   ⚠️ get_feed(p_user_id uuid) legacy aún existe
-- ============================================================================

-- ############################################################################
-- 1. CREAR TABLAS SOCIALES FALTANTES
-- ############################################################################

-- 1.1 Ampliar follows (idempotente)
ALTER TABLE public.follows DROP CONSTRAINT IF EXISTS follows_following_type_check;
ALTER TABLE public.follows ADD CONSTRAINT follows_following_type_check
    CHECK (following_type IN ('artist', 'organizer', 'user'));

-- 1.2 friendships
CREATE TABLE IF NOT EXISTS public.friendships (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    addressee_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'accepted', 'rejected', 'blocked')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(requester_id, addressee_id),
    CHECK (requester_id <> addressee_id)
);
CREATE INDEX IF NOT EXISTS idx_friendships_requester ON public.friendships(requester_id, status);
CREATE INDEX IF NOT EXISTS idx_friendships_addressee ON public.friendships(addressee_id, status);
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "friendships_select_own" ON public.friendships;
CREATE POLICY "friendships_select_own"
    ON public.friendships FOR SELECT
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

DROP POLICY IF EXISTS "friendships_insert_own" ON public.friendships;
CREATE POLICY "friendships_insert_own"
    ON public.friendships FOR INSERT
    WITH CHECK (requester_id = auth.uid());

DROP POLICY IF EXISTS "friendships_update_own" ON public.friendships;
CREATE POLICY "friendships_update_own"
    ON public.friendships FOR UPDATE
    USING (requester_id = auth.uid() OR addressee_id = auth.uid());

-- 1.3 messages
CREATE TABLE IF NOT EXISTS public.messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    content         TEXT NOT NULL,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_messages_participants
    ON public.messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread
    ON public.messages(receiver_id, read_at)
    WHERE read_at IS NULL;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "messages_select_participant" ON public.messages;
CREATE POLICY "messages_select_participant"
    ON public.messages FOR SELECT
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own"
    ON public.messages FOR INSERT
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "messages_update_receiver" ON public.messages;
CREATE POLICY "messages_update_receiver"
    ON public.messages FOR UPDATE
    USING (receiver_id = auth.uid());

-- 1.4 event_invites
CREATE TABLE IF NOT EXISTS public.event_invites (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id        UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
    sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    receiver_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'going', 'not_going', 'maybe')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at    TIMESTAMPTZ,
    UNIQUE(sender_id, receiver_id, event_id),
    CHECK (sender_id <> receiver_id)
);
CREATE INDEX IF NOT EXISTS idx_event_invites_receiver ON public.event_invites(receiver_id, status);
CREATE INDEX IF NOT EXISTS idx_event_invites_event    ON public.event_invites(event_id);
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "event_invites_select_participant" ON public.event_invites;
CREATE POLICY "event_invites_select_participant"
    ON public.event_invites FOR SELECT
    USING (sender_id = auth.uid() OR receiver_id = auth.uid());

DROP POLICY IF EXISTS "event_invites_insert_own" ON public.event_invites;
CREATE POLICY "event_invites_insert_own"
    ON public.event_invites FOR INSERT
    WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "event_invites_update_receiver" ON public.event_invites;
CREATE POLICY "event_invites_update_receiver"
    ON public.event_invites FOR UPDATE
    USING (receiver_id = auth.uid());

-- ############################################################################
-- 2. REHABILITAR REALTIME PARA messages
-- ############################################################################

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END
$$;

-- ############################################################################
-- 3. DROP legacy get_feed(p_user_id uuid) — ya existe get_feed() sin params
-- ############################################################################

DROP FUNCTION IF EXISTS public.get_feed(p_user_id uuid);

-- ############################################################################
-- 4. ACTUALIZAR anonymize_user para limpiar nuevas tablas
-- ############################################################################

CREATE OR REPLACE FUNCTION public.anonymize_user(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
    IF NOT public.is_admin() THEN
        RAISE EXCEPTION 'only admin can anonymize users';
    END IF;
    UPDATE public.profiles
    SET display_name = 'Usuario Eliminado', avatar_url = NULL, phone = NULL, location = NULL, updated_at = NOW()
    WHERE id = p_user_id;
    UPDATE public.tickets
    SET user_id = (SELECT id FROM auth.users WHERE email = 'deleted@anon.local' LIMIT 1)
    WHERE user_id = p_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    DELETE FROM public.geo_consent WHERE user_id = p_user_id;
    DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
    DELETE FROM public.follows WHERE follower_id = p_user_id OR following_id = p_user_id;
    DELETE FROM public.friendships WHERE requester_id = p_user_id OR addressee_id = p_user_id;
    DELETE FROM public.messages WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    DELETE FROM public.event_invites WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    UPDATE auth.users
    SET email = CONCAT('deleted-', p_user_id, '@anon.local'), phone = NULL,
        raw_user_meta_data = '{"deleted": true}'::jsonb, banned_until = '2099-12-31'::timestamptz, deleted_at = NOW()
    WHERE id = p_user_id;
END;
$$;

-- ############################################################################
-- 5. REFRESCAR PostgREST SCHEMA CACHE
-- ############################################################################
-- Esto hace que PostgREST detecte las nuevas tablas y funciones inmediatamente

NOTIFY pgrst, 'reload schema';

-- ############################################################################
-- 6. VERIFICACIÓN
-- ############################################################################

SELECT '✅ Fix aplicado: tablas social + schema cache refresh' AS status;
