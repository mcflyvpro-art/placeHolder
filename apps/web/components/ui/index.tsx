'use client';

import { AnimatePresence, motion, useDragControls } from 'motion/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { spring } from '@/lib/motion';
import s from './ui.module.css';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* Button ------------------------------------------------------------------- */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'plain' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  icon?: boolean;
};

export function Button({ variant = 'secondary', size = 'md', icon, className, type = 'button', ...rest }: BtnProps) {
  return (
    <button
      type={type}
      className={cx(s.btn, s[variant], size !== 'md' && s[size], icon && s.icon, className)}
      {...rest}
    />
  );
}

/* Groupes ------------------------------------------------------------------ */
export function Group({ title, children, className }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {title ? <h3 className={s.groupTitle}>{title}</h3> : null}
      <div className={s.group}>{children}</div>
    </section>
  );
}

export function Row({ label, value, children, onClick }: { label?: ReactNode; value?: ReactNode; children?: ReactNode; onClick?: () => void }) {
  return (
    <div className={s.row} onClick={onClick} role={onClick ? 'button' : undefined}>
      {label !== undefined ? <span className={s.rowLabel}>{label}</span> : null}
      {value !== undefined ? <span className={s.rowValue}>{value}</span> : null}
      {children}
    </div>
  );
}

/* Segmented ---------------------------------------------------------------- */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  const id = useId();
  return (
    <div className={s.segmented} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={s.segment}
          onPointerDown={() => onChange(o.value)}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onChange(o.value)}
        >
          {o.value === value ? (
            <motion.span layoutId={`seg-${id}`} className={s.segmentThumb} transition={spring.snappy} />
          ) : null}
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* Chip / Badge ------------------------------------------------------------- */
export function Chip({ on, children, onClick }: { on?: boolean; children: ReactNode; onClick?: () => void }) {
  return (
    <button type="button" className={cx(s.chip, on && s.chipOn)} aria-pressed={on} onClick={onClick}>
      {children}
    </button>
  );
}

export function Badge({ children, tone }: { children: ReactNode; tone?: 'green' | 'orange' | 'red' | 'accent' | 'purple' }) {
  const style = tone
    ? { background: `color-mix(in srgb, var(--${tone}) 15%, transparent)`, color: `var(--${tone})` }
    : undefined;
  return <span className={s.badge} style={style}>{children}</span>;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={s.kbd}>{children}</kbd>;
}

/* Champs ------------------------------------------------------------------- */
export const fieldClass = s.field;
export const inlineFieldClass = s.inlineField;

/* Jauge -------------------------------------------------------------------- */
export function Gauge({ value, label, size = 52, tone }: { value: number; label?: string; size?: number; tone?: string }) {
  const r = (size - 7) / 2;
  const c = 2 * Math.PI * r;
  // Chaque mesure a sa couleur (anneaux façon Apple Watch) : besoin = rose, capacité = cyan.
  const color = tone ?? (label === 'Besoin' ? 'var(--need)' : label === 'Capacité' ? 'var(--pay)' : 'var(--label)');
  return (
    <div style={{ display: 'grid', justifyItems: 'center' }}>
      <div className={s.gauge} style={{ width: size, height: size }} role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`color-mix(in srgb, ${color} 20%, transparent)`} strokeWidth="6" />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - value / 100) }}
            transition={spring.default}
          />
        </svg>
        <span className={s.gaugeValue}>{value}</span>
      </div>
      {label ? <span className={s.gaugeLabel}>{label}</span> : null}
    </div>
  );
}

/* Sheet : bottom sheet sur mobile (glisser pour fermer), panneau centré sur desktop. */
export function Sheet({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  const controls = useDragControls();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <motion.div className={s.scrim} onClick={onClose} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={spring.default} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            className={s.sheet}
            style={{ x: '-50%' }}
            initial={{ y: '100%', opacity: 0.6 }}
            animate={{ y: typeof window !== 'undefined' && window.innerWidth >= 900 ? '-50%' : 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={spring.sheet}
            drag="y"
            dragControls={controls}
            dragListener={false}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.05, bottom: 0.8 }}
            onDragEnd={(_, info) => {
              if (info.offset.y + info.velocity.y * 0.2 > 120) onClose();
            }}
          >
            <div className={s.grabber} onPointerDown={(e) => controls.start(e)} style={{ touchAction: 'none' }} />
            {children}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/* Toasts ------------------------------------------------------------------- */
type Toast = { id: number; text: ReactNode; action?: { label: string; run: () => void } };
const ToastCtx = createContext<(t: Omit<Toast, 'id'>) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, 'id'>) => {
    const id = Date.now() + Math.random();
    setToasts((x) => [...x.slice(-2), { ...t, id }]);
    setTimeout(() => setToasts((x) => x.filter((y) => y.id !== id)), t.action ? 6000 : 3200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className={s.toasts} aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              layout
              className={s.toast}
              initial={{ opacity: 0, y: 16, scale: 0.96, filter: 'blur(6px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: 8, scale: 0.98, filter: 'blur(6px)' }}
              transition={spring.default}
            >
              <span>{t.text}</span>
              {t.action ? (
                <Button size="sm" variant="secondary" onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>
                  {t.action.label}
                </Button>
              ) : <span style={{ width: 6 }} />}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export const useToast = () => useContext(ToastCtx);

/* État vide ---------------------------------------------------------------- */
export function Empty({ icon, title, action }: { icon: ReactNode; title: ReactNode; action?: ReactNode }) {
  return (
    <div className={s.empty}>
      {icon}
      <p className="t-headline" style={{ color: 'var(--label)' }}>{title}</p>
      {action}
    </div>
  );
}
