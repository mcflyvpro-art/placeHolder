'use client';

import { useCallback, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { CardStack, type Decision, type TriageCard } from '@/components/triage/CardStack';
import { Button, Empty, useToast } from '@/components/ui';
import { triage, undoTriage } from '../actions';

const LABEL: Record<Decision, string> = { kept: 'Gardé', dropped: 'Jeté', hot: 'À appeler maintenant' };

export function TriageClient({ initial }: { initial: TriageCard[] }) {
  const router = useRouter();
  const toast = useToast();
  const [cards, setCards] = useState(initial);
  const [history, setHistory] = useState<{ card: TriageCard; d: Decision }[]>([]);
  const [, start] = useTransition();

  const onDecide = useCallback(
    (card: TriageCard, d: Decision) => {
      setCards((c) => c.filter((x) => x.id !== card.id));
      setHistory((h) => [{ card, d }, ...h].slice(0, 10));
      start(() => triage(card.id, d));
      if (d === 'hot') toast({ text: `${card.name} · ${LABEL[d]}`, action: { label: 'Fiche', run: () => router.push(`/prospects/${card.id}`) } });
    },
    [router, toast],
  );

  const onUndo = useCallback(() => {
    const [last, ...rest] = history;
    if (!last) return;
    setHistory(rest);
    setCards((c) => [last.card, ...c]);
    start(() => undoTriage(last.card.id));
  }, [history]);

  if (!cards.length) {
    return (
      <Empty
        icon={<Layers />}
        title="Pile vide"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {history.length ? <Button onClick={onUndo}>Annuler</Button> : null}
            <Button variant="primary" onClick={() => router.push('/radar')}>Radar</Button>
          </div>
        }
      />
    );
  }

  return <CardStack cards={cards} onDecide={onDecide} onUndo={onUndo} canUndo={history.length > 0} />;
}
