import { NextResponse, type NextRequest } from 'next/server';
import { ownerOrNull } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const sb = await ownerOrNull();
  if (!sb) return NextResponse.json([], { status: 401 });
  const q = (req.nextUrl.searchParams.get('q') ?? '').replace(/[%,()]/g, ' ').trim();
  if (q.length < 2) return NextResponse.json([]);
  const { data } = await sb
    .from('prospects')
    .select('id, name, city, status')
    .or(`name.ilike.%${q}%,city.ilike.%${q}%,siren.eq.${q.replace(/\s/g, '')}`)
    .neq('triage', 'dropped')
    .order('priority', { ascending: false })
    .limit(8);
  return NextResponse.json(data ?? []);
}
