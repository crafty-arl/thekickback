-- Function to expire stale sessions (called via API or cron)
CREATE OR REPLACE FUNCTION expire_stale_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE sessions
  SET status = 'expired', ended_at = expires_at
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at < now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;
