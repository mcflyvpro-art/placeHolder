import { NextResponse } from 'next/server';
import { ownerOrNull } from '@/lib/auth';
import { radarStep } from '@/lib/radar';

export const maxDuration = 60;

export async function POST(req: Request) {
  const sb = await ownerOrNull();
  if (!sb) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, resume } = (await req.json()) as { id: string; resume?: boolean };
  if (resume) await sb.from('ph_searches').update({ status: 'running', error: null }).eq('id', id);
  try {
    return NextResponse.json(await radarStep(sb, id));
  } catch (e) {
    const message = e instanceof Error ? e.message : 'erreur';
    await sb.from('ph_searches').update({ status: 'paused', error: message }).eq('id', id);
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
