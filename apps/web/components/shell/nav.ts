import {
  Sun,
  Radar,
  Layers,
  KanbanSquare,
  PenTool,
  FileSignature,
  Settings2,
  type LucideIcon,
} from 'lucide-react';

export type NavItem = { href: string; label: string; icon: LucideIcon; key: string; tint: string };
export type NavSection = { title: string; items: NavItem[] };

/** Chaque écran a sa teinte (tuile d'icône), comme les apps système. */
export const SECTIONS: NavSection[] = [
  {
    title: 'Vendre',
    items: [
      { href: '/today', label: 'Aujourd’hui', icon: Sun, key: '1', tint: '#ff9f43' },
      { href: '/triage', label: 'Tri', icon: Layers, key: '2', tint: '#34d17a' },
      { href: '/pipeline', label: 'Pipeline', icon: KanbanSquare, key: '3', tint: '#a77bff' },
    ],
  },
  {
    title: 'Produire',
    items: [
      { href: '/radar', label: 'Radar', icon: Radar, key: '4', tint: '#3e9bff' },
      { href: '/atelier', label: 'Atelier', icon: PenTool, key: '5', tint: '#ff5c8a' },
      { href: '/closing', label: 'Closing', icon: FileSignature, key: '6', tint: '#2cc6c0' },
    ],
  },
];

export const SETTINGS: NavItem = { href: '/settings', label: 'Réglages', icon: Settings2, key: '7', tint: '#8e8aa8' };

export const NAV: NavItem[] = [...SECTIONS.flatMap((s) => s.items), SETTINGS];

/** Onglets mobiles : les 4 écrans du quotidien + « Plus ». */
export const MOBILE_TABS = ['/today', '/triage', '/pipeline', '/atelier'];
