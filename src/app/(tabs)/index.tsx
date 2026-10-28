import { useRouter } from 'expo-router';
import { ChevronRightIcon, DumbbellIcon } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

import { HeroCard } from '@/components/gradient';
import { Badge, ErrorView, LoadingView, Screen, toneForSession } from '@/components/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { clockTime, dayLabel, shortDate, todayISO } from '@/lib/dates';
import { formatMoney, labelize } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { DashboardData, WorkloadData } from '@/lib/types';

interface StatItem {
  label: string;
  value: string;
}

const STAT_TONES: Record<string, string> = {
  'Total clients': 'bg-indigo-500/10 ring-indigo-500/20 text-indigo-600 dark:text-indigo-300',
  Paid: 'bg-emerald-500/10 ring-emerald-500/20 text-emerald-600 dark:text-emerald-300',
  Trial: 'bg-sky-500/10 ring-sky-500/20 text-sky-600 dark:text-sky-300',
  Illustrative: 'bg-slate-500/10 ring-slate-500/20 text-slate-600 dark:text-slate-300',
  'Payment due': 'bg-amber-500/10 ring-amber-500/25 text-amber-600 dark:text-amber-300',
  Blocked: 'bg-rose-500/10 ring-rose-500/25 text-rose-600 dark:text-rose-300',
  Inactive: 'bg-violet-500/10 ring-violet-500/20 text-violet-600 dark:text-violet-300',
  'Unpaid invoices': 'bg-orange-500/10 ring-orange-500/25 text-orange-600 dark:text-orange-300',
  'Revenue this month': 'bg-teal-500/10 ring-teal-500/20 text-teal-600 dark:text-teal-300',
};

function StatCard({ label, value }: StatItem) {
  return (
    <View
      className={cn(
        'flex-1 flex-col gap-1 rounded-2xl p-4 ring-1 ring-inset',
        STAT_TONES[label] ?? 'bg-card ring-border text-foreground'
      )}>
      <Text className="text-2xl font-bold tabular-nums">{value}</Text>
      <Text className="text-xs font-medium opacity-80">{label}</Text>
    </View>
  );
}

function StatGrid({ stats }: { stats: StatItem[] }) {
  const rows: StatItem[][] = [];
  for (let i = 0; i < stats.length; i += 2) rows.push(stats.slice(i, i + 2));
  return (
    <View className="gap-3">
      {rows.map((row, index) => (
        <View key={index} className="flex-row gap-3">
          {row.map((stat) => (
            <StatCard key={stat.label} label={stat.label} value={stat.value} />
          ))}
          {row.length === 1 ? <View className="flex-1" /> : null}
        </View>
      ))}
    </View>
  );
}

function BarChart({
  data,
  formatValue,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <View className="flex-row items-end gap-2">
      {data.map((d) => (
        <View key={d.label} className="flex-1 items-center gap-1">
          <View className="h-24 w-full items-center justify-end">
            <View
              className={d.highlight ? 'w-full rounded-md bg-primary' : 'w-full rounded-md bg-primary/35'}
              style={{ height: Math.max(4, Math.round((d.value / max) * 96)) }}
            />
          </View>
          <Text className="text-xs text-muted-foreground">{d.label}</Text>
          <Text className="text-xs font-medium">{formatValue ? formatValue(d.value) : String(d.value)}</Text>
        </View>
      ))}
    </View>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="bg-card gap-4 rounded-2xl border border-border/60 p-5 shadow-sm shadow-black/[0.06] dark:shadow-black/30">
      <Text className="text-base font-bold">{title}</Text>
      {children}
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
        { label: 'Total clients', value: String(dashboard.counts.total) },
        { label: 'Paid', value: String(dashboard.counts.paid) },
        { label: 'Trial', value: String(dashboard.counts.trial) },
        { label: 'Illustrative', value: String(dashboard.counts.illustrative) },
        { label: 'Payment due', value: String(dashboard.counts.payment_due) },
        { label: 'Blocked', value: String(dashboard.counts.blocked) },
        { label: 'Needs period', value: String(dashboard.counts.needs_period ?? 0) },
        { label: 'Inactive', value: String(dashboard.counts.inactive) },
        { label: 'Unpaid invoices', value: String(dashboard.unpaid_invoices) },
        { label: 'Revenue this month', value: formatMoney(dashboard.revenue_this_month) },
      ]
    : [];

  const retention = dashboard?.retention_rate;
  const retentionValue = retention?.value ?? null;
  const retentionLabel =
    retentionValue == null ? '—' : `${retentionValue <= 1 ? Math.round(retentionValue * 100) : Math.round(retentionValue)}%`;

  return (
    <Screen refreshing={refreshing} onRefresh={() => load('refresh')}>
      <HeroCard className="mb-5 mt-5">
        <View className="flex-row items-center justify-between gap-3">
          <View className="flex-1">
            <Text className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {dayLabel(todayISO())}
            </Text>
            <Text className="mt-1 text-2xl font-extrabold text-white">
              {greeting}, {name.split(' ')[0]}
            </Text>
            <Text className="mt-1 text-sm text-white/80">
              Here&apos;s your coaching day at a glance.
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white/15">
            <Icon as={DumbbellIcon} color="#ffffff" size={24} />
          </View>
        </View>
        <View className="mt-4 flex-row gap-3">
          <View className="flex-1 rounded-2xl bg-white/15 p-3">
            <Text className="text-xl font-bold text-white">
              {dashboard?.today_sessions.length ?? 0}
            </Text>
            <Text className="text-xs text-white/80">Sessions today</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/15 p-3">
            <Text className="text-xl font-bold text-white">{dashboard?.counts.total ?? 0}</Text>
            <Text className="text-xs text-white/80">Active clients</Text>
          </View>
          <View className="flex-1 rounded-2xl bg-white/15 p-3">
            <Text className="text-xl font-bold text-white">
              {dashboard ? formatMoney(dashboard.revenue_this_month) : '—'}
            </Text>
            <Text className="text-xs text-white/80">This month</Text>
          </View>
        </View>
      </HeroCard>

      {error ? (
        <View className="mb-4">
          <ErrorView error={error} onRetry={() => load('refresh')} />
        </View>
      ) : null}

      <View className="gap-4">
        <SectionCard title="Overview">
          <StatGrid stats={stats} />
        </SectionCard>

        {workload ? (
          <SectionCard title="Sessions this week">
            <BarChart
              data={workload.days.map((d) => ({ label: d.label, value: d.sessions, highlight: d.is_today }))}
            />
            <View className="flex-row flex-wrap gap-x-4 gap-y-1">
              <Text variant="muted" className="text-xs">
                {workload.totals.sessions} sessions
              </Text>
              <Text variant="muted" className="text-xs">
                {workload.totals.hours} hours
              </Text>
              <Text variant="muted" className="text-xs">
                {workload.totals.avg_sessions_per_day} per day avg
              </Text>
            </View>
          </SectionCard>
        ) : null}

        {dashboard && dashboard.revenue_by_channel.length > 0 ? (
          <SectionCard title="Revenue by channel">
            <BarChart
              data={dashboard.revenue_by_channel.map((c) => ({ label: labelize(c.channel), value: c.total }))}
              formatValue={formatMoney}
            />
          </SectionCard>
        ) : null}

        {retention ? (
          <SectionCard title="Retention">
            <View className="flex-row items-center gap-3">
              <Text className="text-3xl font-semibold">{retentionLabel}</Text>
              <View className="gap-0.5">
                <Text variant="muted" className="text-xs">
                  {retention.started} started · {retention.lost} lost
                </Text>
                <Text variant="muted" className="text-xs">
                  Last {retention.window_days} days
                </Text>
              </View>
            </View>
          </SectionCard>
        ) : null}

        <SectionCard title="Today's sessions">
          {dashboard && dashboard.today_sessions.length > 0 ? (
            <View className="gap-2">
              {dashboard.today_sessions.map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => router.push(`/client/${s.client_id}`)}
                  className="flex-row items-center gap-3 rounded-xl bg-muted/60 px-3 py-3 active:bg-accent/50">
                  <View className="w-16">
                    <Text className="text-sm font-medium">{clockTime(s.time)}</Text>
                  </View>
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm" numberOfLines={1}>
                      {s.client_name}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      {s.duration_minutes} min · {s.is_online ? 'Online' : 'In person'}
                    </Text>
                  </View>
                  <Badge label={labelize(s.status)} tone={toneForSession[s.status]} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text variant="muted">No sessions scheduled today.</Text>
          )}
        </SectionCard>

        <SectionCard title={`Inactive over ${dashboard?.inactive_threshold_days ?? 7} days`}>
          {dashboard && dashboard.inactive_clients.length > 0 ? (
            <View className="gap-2">
              {dashboard.inactive_clients.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => router.push(`/client/${c.id}`)}
                  className="flex-row items-center gap-3 rounded-xl bg-muted/60 px-3 py-3 active:bg-accent/50">
                  <View className="flex-1 gap-0.5">
                    <Text className="text-sm" numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      Last session {shortDate(c.last_session_date)}
                    </Text>
                  </View>
                  <Icon as={ChevronRightIcon} className="text-muted-foreground" size={18} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Text variant="muted">Everyone has been active recently.</Text>
          )}
        </SectionCard>
      </View>
    </Screen>
  );
}
