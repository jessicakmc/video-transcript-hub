import { NextResponse } from 'next/server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

type SessionRow = {
  id: string;
  subtitle_txt_content: string | null;
  summary_status: string;
  summary_txt: string | null;
};

/**
 * Resolves the caller's session row for a job, or the response to send instead.
 *
 * The Secret-key client bypasses RLS, so the `.eq('user_id', user.id)` filter
 * below is the only thing stopping one user reading another user's summary —
 * same contract as the transcript route.
 */
async function loadOwnedSession(
  id: string,
): Promise<{ session: SessionRow } | { error: NextResponse }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: 'unauthorized' }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: job } = await admin
    .from('jobs')
    .select('id, user_id, status, current_session_id')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!job) {
    return { error: NextResponse.json({ error: 'not found' }, { status: 404 }) };
  }
  if (job.status !== 'done' || !job.current_session_id) {
    return { error: NextResponse.json({ error: 'transcript not ready' }, { status: 409 }) };
  }

  const { data: session } = await admin
    .from('job_sessions')
    .select('id, subtitle_txt_content, summary_status, summary_txt')
    .eq('id', job.current_session_id)
    .single();

  if (!session) {
    return { error: NextResponse.json({ error: 'session missing' }, { status: 500 }) };
  }

  return { session: session as SessionRow };
}

/** Current summary state, for the modal and for polling while it is generated. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedSession(id);
  if ('error' in result) return result.error;

  return NextResponse.json(
    {
      status: result.session.summary_status,
      summary: result.session.summary_txt,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Requests a summary. The work happens on the EC2 worker — this only flips the
 * row to 'pending' and the distributor picks it up within 10 seconds.
 *
 * One summary per transcript: an existing 'done' summary is returned as-is
 * rather than regenerated, so the button can never run up a bill. A 'failed'
 * attempt may be retried.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await loadOwnedSession(id);
  if ('error' in result) return result.error;

  const { session } = result;

  if (session.summary_status === 'done') {
    return NextResponse.json({ status: 'done', summary: session.summary_txt });
  }
  if (session.summary_status === 'pending' || session.summary_status === 'running') {
    return NextResponse.json({ status: session.summary_status });
  }
  if (!session.subtitle_txt_content?.trim()) {
    return NextResponse.json({ error: 'transcript is empty' }, { status: 409 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from('job_sessions')
    .update({ summary_status: 'pending' })
    .eq('id', session.id)
    // Only claim a row still in a requestable state — two rapid clicks then
    // enqueue once instead of twice.
    .in('summary_status', ['none', 'failed']);

  if (error) {
    console.error('summary enqueue failed', error);
    return NextResponse.json({ error: 'could not queue the summary' }, { status: 500 });
  }

  return NextResponse.json({ status: 'pending' });
}
