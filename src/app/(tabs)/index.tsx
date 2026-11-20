import { useRouter } from 'expo-router';
import {
  BadgeDollarSignIcon,
  BanIcon,
  CalendarCheckIcon,
  ChevronRightIcon,
  ClockIcon,
  CoinsIcon,
  FlameIcon,
  HeartPulseIcon,
  HourglassIcon,
  PercentIcon,
  ReceiptTextIcon,
  SparklesIcon,
  TrendingUpIcon,
  UserCheckIcon,
  UserMinusIcon,
  UsersIcon,
  VideoIcon,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

import { HeroCard } from '@/components/gradient';
import { alpha, Chip, COLORS, IconBubble, Panel, Ring, SectionHeader, StatTile } from '@/components/kit';
import { Badge, EmptyView, ErrorView, LoadingView, Screen, toneForSession } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clockTime, dayLabel, shortDate, todayISO } from '@/lib/dates';
import { formatMoney, initials, labelize } from '@/lib/format';
import type { DashboardData, WorkloadData } from '@/lib/types';

interface StatItem {
  label: string;
  value: string;
  icon: LucideIcon;
  color: string;
  href?: string;
}

function StatGrid({ stats, onOpen }: { stats: StatItem[]; onOpen: (href: string) => void }) {
  const rows: StatItem[][] = [];
  for (let i = 0; i < stats.length; i += 2) rows.push(stats.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((row, index) => (
        <View key={index} className="flex-row gap-3">
          {row.map((stat) => (
            <View key={stat.label} className="flex-1">
              <StatTile
                icon={stat.icon}
                label={stat.label}
                value={stat.value}
                color={stat.color}
                onPress={stat.href ? () => onOpen(stat.href as string) : undefined}
              />
            </View>
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function BarChart({
  data,
  color = COLORS.green,
  formatValue,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  color?: string;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="flex-row items-end gap-2">
      {data.map((d) => (
        <View key={d.label} className="flex-1 items-center gap-1">
          <View className="h-28 w-full items-center justify-end">
            <View
              style={{
                width: '100%',
                borderRadius: 10,
                height: Math.max(6, Math.round((d.value / max) * 112)),
                backgroundColor: d.highlight ? color : alpha(color, 0.3),
              }}
            />
          </View>
          <Text
            className="text-[11px] font-bold"
            style={{ color: d.highlight ? color : COLORS.muted }}
            numberOfLines={1}>
            {d.label}
          </Text>
          <Text className="text-[11px] font-black" numberOfLines={1}>
            {formatValue ? formatValue(d.value) : String(d.value)}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { trainer } = useAuth();
  const router = useRouter();
  const [dashboard, setDashboard] = React.useState<DashboardData | null>(null);
  const [workload, setWorkload] = React.useState<WorkloadData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (mode: 'initial' | 'refresh') => {
    if (mode === 'refresh') setRefreshing(true);
    else setLoading(true);
    const [summary, week] = await Promise.allSettled([
      api<DashboardData>('dashboard/'),
      api<WorkloadData>('dashboard/workload/'),
    ]);
    if (summary.status === 'fulfilled') {
      setDashboard(summary.value);
      setError(null);
    } else {
      setError(summary.reason instanceof Error ? summary.reason.message : 'Could not load the dashboard.');
    }
    if (week.status === 'fulfilled') setWorkload(week.value);
    setLoading(false);
    setRefreshing(false);
  }, []);

  React.useEffect(() => {
    load('initial');
  }, [load]);

  if (loading && !dashboard) return <LoadingView label="Loading dashboard…" />;
  if (error && !dashboard) return <ErrorView error={error} onRetry={() => load('initial')} />;

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const name = trainer?.full_name?.trim() || trainer?.username || 'Trainer';

  const stats: StatItem[] = dashboard
    ? [
        { label: 'Total clients', value: String(dashboard.counts.total), icon: UsersIcon, color: COLORS.cyan, href: '/clients' },
        { label: 'Paid', value: String(dashboard.counts.paid), icon: BadgeDollarSignIcon, color: COLORS.green, href: '/clients' },
        { label: 'Trial', value: String(dashboard.counts.trial), icon: SparklesIcon, color: COLORS.violet, href: '/clients' },
        { label: 'Illustrative', value: String(dashboard.counts.illustrative), icon: HeartPulseIcon, color: COLORS.pink, href: '/clients' },
        { label: 'Payment due', value: String(dashboard.counts.payment_due), icon: HourglassIcon, color: COLORS.amber, href: '/billing' },
        { label: 'Blocked', value: String(dashboard.counts.blocked), icon: BanIcon, color: COLORS.rose, href: '/clients' },
        { label: 'Discount', value: String(dashboard.counts.discount ?? 0), icon: PercentIcon, color: COLORS.orange, href: '/clients' },
        { label: 'Inactive', value: String(dashboard.counts.inactive), icon: UserMinusIcon, color: COLORS.muted },
        { label: 'Unpaid invoices', value: String(dashboard.unpaid_invoices), icon: ReceiptTextIcon, color: COLORS.amber, href: '/billing' },
        { label: 'Revenue this month', value: formatMoney(dashboard.revenue_this_month), icon: CoinsIcon, color: COLORS.lime, href: '/billing' },
      ]
    : [];

  const retention = dashboard?.retention_rate;
  const retentionValue = retention?.value ?? null;
  const retentionPct = retentionValue == null ? null : retentionValue <= 1 ? retentionValue : retentionValue / 100;
  const retentionLabel = retentionPct == null ? '—' : `${Math.round(retentionPct * 100)}%`;

  const todaySessions = dashboard?.today_sessions ?? [];
  const activeShare =
    dashboard && dashboard.counts.total > 0
      ? (dashboard.counts.total - dashboard.counts.inactive) / dashboard.counts.total
      : 0;

  const heroTiles = [
    { v: String(todaySessions.length), l: 'Sessions today', i: CalendarCheckIcon },
    { v: String(dashboard?.counts.total ?? 0), l: 'Clients', i: UsersIcon },
    { v: dashboard ? formatMoney(dashboard.revenue_this_month) : '—', l: 'This month', i: TrendingUpIcon },
  ];

  return (
    <Screen refreshing={refreshing} onRefresh={() => load('refresh')}>
      <HeroCard className="mb-5 gap-4">
        <View className="flex-row items-center justify-between gap-3">
          <View className="min-w-0 flex-1">
            <Text className="text-xs font-bold uppercase tracking-widest text-white/75">
              {dayLabel(todayISO())}
            </Text>
            <Text className="mt-1 text-[22px] font-black leading-7 tracking-tight text-white" numberOfLines={2}>
              {greeting}, {name.split(' ')[0]}
            </Text>
            <Text className="mt-1 text-sm text-white/80">
              {todaySessions.length > 0
                ? `You have ${todaySessions.length} session${todaySessions.length === 1 ? '' : 's'} today.`
                : 'Light day — a good time to plan ahead.'}
            </Text>
          </View>
          <View className="h-14 w-14 items-center justify-center rounded-3xl bg-white/20">
            <Icon as={FlameIcon} color="#ffffff" size={28} />
          </View>
        </View>
        <View className="flex-row gap-2.5">
          {heroTiles.map((t) => (
            <View key={t.l} className="flex-1 gap-1 rounded-2xl bg-black/20 p-3">
              <Icon as={t.i} color="#ffffff" size={15} />
              <Text className="text-lg font-black text-white" numberOfLines={1}>
                {t.v}
              </Text>
              <Text className="text-[11px] font-semibold text-white/75">{t.l}</Text>
            </View>
          ))}
        </View>
      </HeroCard>

      {error ? (
        <View className="mb-4">
          <ErrorView error={error} onRetry={() => load('refresh')} />
        </View>
      ) : null}

      <View className="gap-5">
        {/* Today's sessions first — it's what a coach checks every morning */}
        <View>
          <SectionHeader
            title="Today's sessions"
            subtitle={todaySessions.length ? 'Tap a session to open the client' : undefined}
            icon={ClockIcon}
            color={COLORS.amber}
            actionLabel="Schedule"
            onAction={() => router.push('/schedule')}
          />
          {todaySessions.length > 0 ? (
            <View className="gap-2.5">
              {todaySessions.map((s) => {
                const accent = s.is_online ? COLORS.cyan : COLORS.amber;
                return (
                  <Panel
                    key={s.id}
                    tint={accent}
                    onPress={() => router.push(`/client/${s.client_id}`)}
                    className="flex-row items-center gap-3 p-3.5">
                    <View
                      className="items-center justify-center rounded-2xl px-2.5 py-2"
                      style={{ backgroundColor: alpha(accent, 0.16) }}>
                      <Text className="text-sm font-black" style={{ color: accent }}>
                        {clockTime(s.time)}
                      </Text>
                    </View>
                    <View className="min-w-0 flex-1 gap-0.5">
                      <Text className="text-[15px] font-bold" numberOfLines={1}>
                        {s.client_name}
                      </Text>
                      <View className="flex-row items-center gap-1">
                        <Icon as={s.is_online ? VideoIcon : UserCheckIcon} size={12} color={COLORS.muted} />
                        <Text variant="muted" className="text-xs">
                          {s.duration_minutes} min · {s.is_online ? 'Online' : 'In person'}
                        </Text>
                      </View>
                    </View>
                    <Badge label={labelize(s.status)} tone={toneForSession[s.status]} />
                  </Panel>
                );
              })}
            </View>
          ) : (
            <EmptyView
              icon={CalendarCheckIcon}
              color={COLORS.amber}
              title="Nothing scheduled today"
              subtitle="Enjoy the breathing room, or book a session from the Schedule tab."
            />
          )}
        </View>

        <View>
          <SectionHeader title="Overview" subtitle="Your roster at a glance" icon={UsersIcon} color={COLORS.cyan} />
          <StatGrid stats={stats} onOpen={(href) => router.push(href as never)} />
        </View>

        {workload ? (
          <Panel className="gap-4">
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-row items-center gap-2.5">
                <IconBubble icon={CalendarCheckIcon} color={COLORS.green} size={32} />
                <Text className="text-[15px] font-bold tracking-tight">Sessions this week</Text>
              </View>
              <Chip label={`${workload.totals.sessions} total`} color={COLORS.green} />
            </View>
            <BarChart
              data={workload.days.map((d) => ({ label: d.label, value: d.sessions, highlight: d.is_today }))}
            />
            <View className="flex-row gap-2">
              <Chip label={`${workload.totals.hours} hours`} color={COLORS.sky} />
              <Chip label={`${workload.totals.avg_sessions_per_day} per day`} color={COLORS.violet} />
            </View>
          </Panel>
        ) : null}

        {dashboard && dashboard.revenue_by_channel.length > 0 ? (
          <Panel className="gap-4">
            <View className="flex-row items-center gap-2.5">
              <IconBubble icon={CoinsIcon} color={COLORS.lime} size={32} />
              <Text className="text-[15px] font-bold tracking-tight">Revenue by channel</Text>
            </View>
            <BarChart
              color={COLORS.lime}
              data={dashboard.revenue_by_channel.map((c) => ({ label: labelize(c.channel), value: c.total }))}
              formatValue={formatMoney}
            />
          </Panel>
        ) : null}

        <View className="flex-row gap-3">
          {retention ? (
            <Panel tint={COLORS.violet} className="flex-1 items-center gap-3">
              <Ring progress={retentionPct ?? 0} size={92} stroke={10} color={COLORS.violet}>
                <Text className="text-xl font-black">{retentionLabel}</Text>
              </Ring>
              <View className="items-center gap-0.5">
                <Text className="text-sm font-bold">Retention</Text>
                <Text variant="muted" className="text-center text-[11px]">
                  {retention.started} started · {retention.lost} lost
                </Text>
                <Text variant="muted" className="text-[11px]">
                  Last {retention.window_days} days
                </Text>
              </View>
            </Panel>
          ) : null}
          <Panel tint={COLORS.green} className="flex-1 items-center gap-3">
            <Ring progress={activeShare} size={92} stroke={10} color={COLORS.green}>
              <Text className="text-xl font-black">{Math.round(activeShare * 100)}%</Text>
            </Ring>
            <View className="items-center gap-0.5">
              <Text className="text-sm font-bold">Active clients</Text>
              <Text variant="muted" className="text-center text-[11px]">
                {dashboard ? dashboard.counts.total - dashboard.counts.inactive : 0} of {dashboard?.counts.total ?? 0}
              </Text>
            </View>
          </Panel>
        </View>

        <View>
          <SectionHeader
            title={`Inactive over ${dashboard?.inactive_threshold_days ?? 7} days`}
            subtitle="Clients who may need a nudge"
            icon={UserMinusIcon}
            color={COLORS.rose}
          />
          {dashboard && dashboard.inactive_clients.length > 0 ? (
            <View className="gap-2.5">
              {dashboard.inactive_clients.map((c) => (
                <Panel
                  key={c.id}
                  onPress={() => router.push(`/client/${c.id}`)}
                  className="flex-row items-center gap-3 p-3.5">
                  <View
                    className="h-11 w-11 items-center justify-center rounded-full"
                    style={{
                      backgroundColor: alpha(COLORS.rose, 0.16),
                      borderWidth: 1,
                      borderColor: alpha(COLORS.rose, 0.35),
                    }}>
                    <Text className="text-sm font-black" style={{ color: COLORS.rose }}>
                      {initials(c.name)}
                    </Text>
                  </View>
                  <View className="min-w-0 flex-1 gap-0.5">
                    <Text className="text-[15px] font-bold" numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      Last session {shortDate(c.last_session_date)}
                    </Text>
                  </View>
                  <Icon as={ChevronRightIcon} size={18} color={COLORS.muted} />
                </Panel>
              ))}
            </View>
          ) : (
            <EmptyView
              icon={UserCheckIcon}
              color={COLORS.green}
              title="Everyone is active"
              subtitle="No client has gone quiet recently. Nice coaching."
            />
          )}
        </View>
      </View>
    </Screen>
  );
}
