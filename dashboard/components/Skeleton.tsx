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

// ── Lead detail skeleton (two-column layout) ──────────────────────────────────

export function LeadDetailSkeleton() {
  const { c } = useTheme();
  const card = { background: c.card, border: c.cardBorder, borderRadius: 16 };
  return (
    <div style={{ padding: 32, maxWidth: 1100, margin: '0 auto' }}>
      {/* Breadcrumb */}
      <Skeleton width={160} height={13} style={{ marginBottom: 28 }} />

      {/* Hero card */}
      <div style={{ ...card, padding: 24, marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <Skeleton width={56} height={56} borderRadius={28} />
          <div style={{ flex: 1 }}>
            <Skeleton width="38%" height={26} style={{ marginBottom: 10 }} />
            <Skeleton width="52%" height={13} />
          </div>
          <Skeleton width={82} height={28} borderRadius={14} />
        </div>
        <Skeleton width="100%" height={5} borderRadius={3} style={{ marginBottom: 8 }} />
        <div style={{ display: 'flex', gap: 24, paddingTop: 16, borderTop: `1px solid ${c.divider}` }}>
          <Skeleton width={160} height={11} />
          <Skeleton width={140} height={11} />
        </div>
      </div>

      {/* Two columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 20 }}>
        {/* Left */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...card, padding: 20 }}>
            <Skeleton width="30%" height={10} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="88%"  height={11} style={{ marginBottom: 8 }} />
            <Skeleton width="72%"  height={11} />
          </div>
          <div style={{ ...card, overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', background: c.muted, borderBottom: `1px solid ${c.divider}` }}>
              <Skeleton width="42%" height={13} />
            </div>
            <div style={{ padding: 20 }}>
              <Skeleton width="100%" height={11} style={{ marginBottom: 8 }} />
              <Skeleton width="82%"  height={11} />
            </div>
          </div>
        </div>
        {/* Right */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ ...card, padding: 20 }}>
            <Skeleton width="38%" height={10} style={{ marginBottom: 16 }} />
            {[1,2,3,4].map(i => <Skeleton key={i} width="100%" height={40} borderRadius={10} style={{ marginBottom: 6 }} />)}
          </div>
          <div style={{ ...card, padding: 20 }}>
            <Skeleton width="48%" height={10} style={{ marginBottom: 16 }} />
            {[1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <Skeleton width={7} height={7} borderRadius="50%" style={{ marginTop: 3, flexShrink: 0 }} />
                <Skeleton width="88%" height={11} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
