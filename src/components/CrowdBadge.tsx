import { AlertCircle, AlertTriangle, CheckCircle2, Flame, MinusCircle } from 'lucide-react';
import { CrowdLevel } from '../types/qlite';

interface CrowdIndicatorProps {
  level: CrowdLevel | null;
  label: string;
  percentage?: number | null;
  compact?: boolean;
}

export function CrowdIndicator({ level, label, percentage, compact = false }: CrowdIndicatorProps) {
  if (!level) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 text-slate-600 font-medium whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <MinusCircle className="w-3.5 h-3.5 text-slate-400 shrink-0" aria-hidden="true" />
        <span>{label}</span>
      </span>
    );
  }

  const pctSuffix = typeof percentage === 'number' ? ` ${percentage}%` : '';

  if (level === 'low') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-800 font-semibold whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" aria-hidden="true" />
        <span>
          {label}
          {pctSuffix && <span className="font-mono tabular-nums">{pctSuffix}</span>}
        </span>
      </span>
    );
  }

  if (level === 'moderate') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-yellow-300 bg-yellow-50 text-yellow-900 font-semibold whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <AlertCircle className="w-3.5 h-3.5 text-yellow-600 shrink-0" aria-hidden="true" />
        <span>
          {label}
          {pctSuffix && <span className="font-mono tabular-nums">{pctSuffix}</span>}
        </span>
      </span>
    );
  }

  if (level === 'high') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 text-orange-800 font-semibold whitespace-nowrap shrink-0 ${
          compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" aria-hidden="true" />
        <span>
          {label}
          {pctSuffix && <span className="font-mono tabular-nums">{pctSuffix}</span>}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 text-red-800 font-semibold whitespace-nowrap shrink-0 ${
        compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs'
      }`}
    >
      <Flame className="w-3.5 h-3.5 text-red-600 shrink-0" aria-hidden="true" />
      <span>
        {label}
        {pctSuffix && <span className="font-mono tabular-nums">{pctSuffix}</span>}
      </span>
    </span>
  );
}

export function getCrowdBarColor(level: CrowdLevel | null): string {
  if (!level) return 'bg-slate-300';
  if (level === 'low') return 'bg-emerald-600';
  if (level === 'moderate') return 'bg-yellow-500';
  if (level === 'high') return 'bg-orange-500';
  return 'bg-red-600';
}

export function getCrowdPinColor(level: CrowdLevel | null): { bg: string; border: string } {
  if (!level) return { bg: '#64748B', border: '#334155' };
  if (level === 'low') return { bg: '#16A34A', border: '#14532D' };
  if (level === 'moderate') return { bg: '#EAB308', border: '#854D0E' };
  if (level === 'high') return { bg: '#EA580C', border: '#9A3412' };
  return { bg: '#DC2626', border: '#7F1D1D' };
}
