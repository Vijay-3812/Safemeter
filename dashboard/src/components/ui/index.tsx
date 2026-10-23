import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import * as SwitchPrimitive from '@radix-ui/react-switch';
import { AlertCircle, CheckCheck, CircleX, ShieldCheck, Truck, X } from 'lucide-react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { Status } from '../../data/types';
import { statusLabel } from '../../lib/severity';
import { useDashboardStore } from '../../store/useDashboardStore';
import { AnimatePresence, motion } from 'motion/react';
export const cn = (...values: Parameters<typeof clsx>) => twMerge(clsx(...values));
export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  }
>(({ className, variant = 'secondary', ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn('button', `button-${variant}`, className)}
    {...props}
  />
));
Button.displayName = 'Button';
export function Tooltip({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className="tooltip" sideOffset={7}>
          {label}
          <TooltipPrimitive.Arrow className="tooltip-arrow" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}
const icons = {
  alerted: AlertCircle,
  responder_assigned: Truck,
  responder_arrived: ShieldCheck,
  closed: CheckCheck,
  cancelled: CircleX,
};
export function Pill({ status }: { status: Status }) {
  const Icon = icons[status];
  return (
    <span className={cn('pill', `status-${status}`)}>
      <Icon size={12} />
      {statusLabel[status]}
    </span>
  );
}
export function Badge({ children }: { children: ReactNode }) {
  return <span className="badge">{children}</span>;
}
export function Switch({
  checked,
  onCheckedChange,
  label,
}: {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <SwitchPrimitive.Root
      aria-label={label}
      className="switch"
      checked={checked}
      onCheckedChange={onCheckedChange}
    >
      <SwitchPrimitive.Thumb className="switch-thumb" />
    </SwitchPrimitive.Root>
  );
}
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} aria-label="Loading" />;
}
export function Toasts() {
  const toasts = useDashboardStore((s) => s.toasts);
  const dismiss = useDashboardStore((s) => s.dismiss);
  const select = useDashboardStore((s) => s.select);
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            className="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: 20 }}
          >
            <ShieldCheck size={18} className="text-accent" />
            <span>{t.message}</span>
            {t.incidentId && (
              <Button
                variant="ghost"
                onClick={() => {
                  select(t.incidentId!);
                  dismiss(t.id);
                }}
              >
                View
              </Button>
            )}
            <Button variant="ghost" aria-label="Dismiss notification" onClick={() => dismiss(t.id)}>
              <X size={14} />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
