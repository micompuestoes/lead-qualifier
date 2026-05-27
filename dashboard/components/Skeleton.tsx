'use client';

// Primitivo de skeleton + variantes de tarjeta
import { useTheme } from './ThemeProvider';

// ── Primitivo ─────────────────────────────────────────────────────────────────

interface SkeletonProps {
  width?:        string | number;
  height?:       string | number;
  borderRadius?: string | number;
  style?:        React.CSSProperties;
}

export function Skeleton({ width = '100%', height = 16, borderRadius = 6, style }: SkeletonProps) {
  return (
    <div
      className="skeleton-shimmer"
      style={{ width, height, borderRadius, flexShrink: 0, ...style }}
    />
  );
}

// ── LeadCard skeleton ─────────────────────────────────────────────────────────

export function LeadCardSkeleton() {
  const { c } = useTheme();
  return (
    <div style={{
      background: c.card, border: c.cardBorder, borderRadius: 12,
      padding: 20, display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {/* Avatar + nombre */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Skeleton width={38} height={38} borderRadius={19} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 7 }}>
          <Skeleton width="52%" height={13} />
          <Skeleton width="72%" height={11} />
        </div>
        <Skeleton width={58} height={22} borderRadius={10} />
      </div>
      {/* Mensaje */}
      <Skeleton width="100%" height={11} />
      <Skeleton width="78%"  height={11} />
      {/* Score bar */}
      <Skeleton width="100%" height={5} borderRadius={3} style={{ marginTop: 4 }} />
      {/* Footer */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginTop: 4, paddingTop: 12, borderTop: `1px solid ${c.divider}`,
      }}>
        <Skeleton width={76} height={24} borderRadius={8} />
        <Skeleton width={48} height={11} />
      </div>
    </div>
  );
}

// ── KPI skeleton (home page) ──────────────────────────────────────────────────

export function KpiSkeleton() {
  const { c } = useTheme();
  return (
    <div style={{ background: c.card, border: c.cardBorder, borderRadius: 14, padding: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
        <Skeleton width="45%" height={11} />
        <Skeleton width={30} height={30} borderRadius={9} />
      </div>
      <Skeleton width="40%" height={36} borderRadius={6} style={{ marginBottom: 8 }} />
      <Skeleton width="60%" height={11} />
    </div>
  );
}
