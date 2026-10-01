import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ownerOrNull } from '@/lib/auth';
import { planTasks } from '@/lib/radar';
import { integrations } from '@/lib/env';

const Body = z.object({
  sectors: z.array(z.string()).min(1),
  zone: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('france') }),
    z.object({ kind: z.literal('regions'), codes: z.array(z.string()).min(1) }),
    z.object({ kind: z.literal('departements'), codes: z.array(z.string()).min(1) }),
  ]),
  budget: z.number().int().min(1).max(500),
});

export async function POST(req: Request) {
  const sb = await ownerOrNull();
  if (!sb) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  if (!integrations().google) return NextResponse.json({ error: 'google' }, { status: 412 });
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return NextResponse.json({ error: 'invalid' }, { status: 400 });
  const { sectors, zone, budget } = parsed.data;
  const tasks = planTasks(sectors, zone, budget);
  if (!tasks.length) return NextResponse.json({ error: 'empty' }, { status: 400 });
  const { data, error } = await sb.from('searches').insert({ sectors, zone, tasks }).select('id').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ id: data.id, total: tasks.length });
}
