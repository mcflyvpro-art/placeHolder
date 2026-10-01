import {
  CalendarCheck2,
  Radar,
  Layers,
  KanbanSquare,
  PenTool,
  FileSignature,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; key: string };

export const NAV: NavItem[] = [
  { href: '/today', label: 'Aujourd’hui', icon: CalendarCheck2, key: '1' },
  { href: '/radar', label: 'Radar', icon: Radar, key: '2' },
  { href: '/triage', label: 'Tri', icon: Layers, key: '3' },
  { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare, key: '4' },
  { href: '/atelier', label: 'Atelier', icon: PenTool, key: '5' },
  { href: '/closing', label: 'Closing', icon: FileSignature, key: '6' },
  { href: '/settings', label: 'Réglages', icon: Settings2, key: '7' },
];

/** Onglets mobiles : les 4 écrans du quotidien + « Plus ». */
export const MOBILE_TABS = ['/today', '/triage', '/pipeline', '/atelier'];
