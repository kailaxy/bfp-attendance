import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, ErrorState, LoadingState } from '../components';
import { useDashboardData } from '../hooks';
import { getQueuedScanCount, getSyncState } from '../services';
import { spacing, typography, type AppColors, useAppTheme } from '../theme';
import type { ApiErrorPayload, AttendanceLogEntry } from '../types';

type SyncStatus = {
  pendingQueueCount: number;
  lastSyncAt: string;
  lastError: string;
};

type DashboardData = {
  totalPersonnel: number;
  activeOnDuty: number;
  offDutyToday: number;
  onLeaveCount: number;
  totalLogs: number;
  lastUpdated: string;
  recent: AttendanceLogEntry[];
};

const asText = (value: string | undefined, fallback: string) => {
  const text = String(value || '').trim();
  return text || fallback;
};

const toDisplayName = (entry: {
  name?: string;
  firstName?: string;
  lastName?: string;
  rank?: string;
}) => {
  const firstName = asText(entry.firstName, '');
  const lastName = asText(entry.lastName, '');
  const rank = asText(entry.rank, '');

  if (firstName && lastName) {
    return [rank, lastName, firstName].filter(Boolean).join(' ').trim();
  }

  return asText(entry.name, 'Unknown Personnel');
};

const toTimeValue = (timestamp: string | undefined): number => {
  const parsed = new Date(String(timestamp || '')).getTime();
  return Number.isNaN(parsed) ? -1 : parsed;
};

const normalizeStatus = (status: string | undefined): 'IN' | 'OUT' | 'UNKNOWN' => {
  const value = String(status || '').trim().toUpperCase();

  if (['IN', 'TIMEIN', 'TIME-IN', 'ON-DUTY', 'ONDUTY'].includes(value)) {
    return 'IN';
  }

  if (['OUT', 'TIMEOUT', 'TIME-OUT', 'OFF-DUTY', 'OFFDUTY'].includes(value)) {
    return 'OUT';
  }

  return 'UNKNOWN';
};

const formatLastUpdated = (timestamp: string) => {
  const parsed = new Date(timestamp);
  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatSource = (source: string | undefined) => {
  const value = String(source || '').trim().toLowerCase();
  if (value === 'raw') return 'RAW';
  if (value === 'archive') return 'ARCHIVE';
  return 'UNKNOWN';
};

const getStatusTone = (status: 'IN' | 'OUT' | 'UNKNOWN', colors: AppColors) => {
  if (status === 'IN') return colors.success;
  if (status === 'OUT') return colors.warning;
  return colors.textSecondary;
};

const getDeterministicDashboardError = (error: ApiErrorPayload | null): string => {
  if (!error) {
    return 'Unable to load dashboard data. Please retry.';
  }

  const code = String(error.code || '').trim().toUpperCase();

  if (code === 'CONFIG_ERROR') {
    return 'Dashboard API is not configured. Please contact the administrator.';
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return 'Cannot reach attendance server right now. Please retry.';
  }

  if (code === 'HTTP_ERROR' || code === 'INTERNAL_ERROR') {
    return 'Attendance service returned an error. Please retry.';
  }

  return asText(error.message, 'Unable to load dashboard data. Please retry.');
};

const computeDashboardData = (
  logs: AttendanceLogEntry[],
  totalPersonnel: number,
  onLeaveCount: number
): DashboardData => {
  const sorted = [...logs].sort((a, b) => toTimeValue(b.timestamp) - toTimeValue(a.timestamp));

  const latestByPersonnel = new Map<string, AttendanceLogEntry>();
  sorted.forEach((entry) => {
    const personnelId = asText(entry.personnelId, '');
    if (!personnelId || latestByPersonnel.has(personnelId)) {
      return;
    }

    latestByPersonnel.set(personnelId, entry);
  });

  const latest = Array.from(latestByPersonnel.values());
  const activeOnDuty = latest.filter((entry) => normalizeStatus(entry.status) === 'IN').length;
  const offDutyToday = latest.filter((entry) => normalizeStatus(entry.status) === 'OUT').length;

  return {
    totalPersonnel,
    activeOnDuty,
    offDutyToday,
    onLeaveCount,
    totalLogs: sorted.length,
    lastUpdated: sorted[0]?.timestamp || '',
    recent: sorted.slice(0, 8),
  };
};

export const DashboardScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    logs,
    personnel,
    leaves,
    isLoading,
    isRefreshing,
    error: errorPayload,
    lastUpdatedLogs,
    refresh,
  } = useDashboardData();
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({
    pendingQueueCount: 0,
    lastSyncAt: '',
    lastError: '',
  });
  const [activitySearch, setActivitySearch] = useState('');

  const dashboard = useMemo(
    () => computeDashboardData(logs, personnel.length, leaves.length),
    [logs, personnel.length, leaves.length]
  );

  const loadSyncStatus = useCallback(async () => {
    const [persistedSync, queuedCount] = await Promise.all([
      getSyncState(),
      getQueuedScanCount(),
    ]);

    setSyncStatus({
      pendingQueueCount: queuedCount,
      lastSyncAt: persistedSync.lastSyncAt,
      lastError: persistedSync.lastError,
    });
  }, []);

  useEffect(() => {
    void loadSyncStatus();
  }, [loadSyncStatus]);

  useFocusEffect(
    useCallback(() => {
      refresh();
      void loadSyncStatus();
      return () => {};
    }, [loadSyncStatus, refresh])
  );

  const handleRetry = useCallback(() => {
    refresh();
    void loadSyncStatus();
  }, [loadSyncStatus, refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
    void loadSyncStatus();
  }, [loadSyncStatus, refresh]);

  const summaryRows = useMemo(() => {
    if (!dashboard) {
      return [];
    }

    return [
      { label: 'Total Personnel', value: String(dashboard.totalPersonnel) },
      { label: 'Active On-Duty', value: String(dashboard.activeOnDuty) },
      { label: 'Completed Shift', value: String(dashboard.offDutyToday) },
      { label: 'On Leave', value: String(dashboard.onLeaveCount) },
      { label: 'Total Logs', value: String(dashboard.totalLogs) },
      { label: 'Last Updated', value: formatLastUpdated(lastUpdatedLogs || dashboard.lastUpdated) },
    ];
  }, [dashboard, lastUpdatedLogs]);

  const filteredRecent = useMemo(() => {
    const query = activitySearch.trim().toLowerCase();
    if (!query) {
      return dashboard?.recent || [];
    }

    return (dashboard?.recent || []).filter((entry) => {
      const haystack = [
        toDisplayName(entry),
        asText(entry.firstName, ''),
        asText(entry.lastName, ''),
        asText(entry.personnelId, ''),
        asText(entry.unit, ''),
        asText(entry.status, ''),
        asText(entry.source, ''),
        asText(entry.timestamp, ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activitySearch, dashboard?.recent]);

  if (isLoading) {
    return <LoadingState message="Loading dashboard metrics and latest raw activity..." />;
  }

  if (errorPayload) {
    return (
      <View style={styles.stateContainer}>
        <ErrorState
          title="Dashboard unavailable"
          message={getDeterministicDashboardError(errorPayload)}
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </View>
    );
  }

  if (!dashboard || dashboard.totalLogs === 0) {
    return (
      <EmptyState
        title="No dashboard data"
        message="No attendance activity is available yet."
        actionLabel="Refresh"
        onAction={handleRefresh}
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
          colors={[colors.primary]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      <View style={styles.heroCard}>
        <Text style={styles.title}>Dashboard</Text>
        <Text style={styles.subtitle}>Mobile operational summary</Text>
        <View style={styles.headerInfoRow}>
          <Text style={styles.caption}>Queued scans</Text>
          <Text style={styles.heroValue}>{syncStatus.pendingQueueCount}</Text>
        </View>
        <View style={styles.headerInfoRow}>
          <Text style={styles.caption}>Last sync</Text>
          <Text style={styles.heroSubValue}>
            {syncStatus.lastSyncAt ? formatLastUpdated(syncStatus.lastSyncAt) : 'Never'}
          </Text>
        </View>
        {syncStatus.lastError ? (
          <View style={styles.syncErrorBox}>
            <Text style={styles.syncError}>Sync issue: {syncStatus.lastError}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.grid}>
        {summaryRows.map((row) => (
          <View key={row.label} style={styles.metricCard}>
            <Text style={styles.metricLabel}>{row.label}</Text>
            <Text style={styles.metricValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Recent Activity</Text>
        <View style={styles.searchRow}>
          <TextInput
            value={activitySearch}
            onChangeText={setActivitySearch}
            placeholder="Search recent activity"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, styles.searchInputFlex]}
          />
          {activitySearch.trim().length > 0 ? (
            <Pressable style={styles.clearSearchButton} onPress={() => setActivitySearch('')}>
              <Text style={styles.clearSearchLabel}>X</Text>
            </Pressable>
          ) : null}
        </View>
        {filteredRecent.map((entry, index) => (
          <View key={`${asText(entry.id, 'entry')}-${index}`} style={styles.activityRow}>
            <View style={styles.activityLeft}>
              <Text style={styles.activityName}>{toDisplayName(entry)}</Text>
              <Text style={styles.activityMeta}>
                {asText(entry.personnelId, 'N/A')} • {asText(entry.unit, 'N/A')}
              </Text>
            </View>
            <View style={styles.activityRight}>
              <Text
                style={[
                  styles.activityStatus,
                  { color: getStatusTone(normalizeStatus(entry.status), colors) },
                ]}
              >
                {normalizeStatus(entry.status)}
              </Text>
              <Text style={styles.activitySource}>{formatSource(entry.source)}</Text>
              <Text style={styles.activityTime}>{formatLastUpdated(entry.timestamp)}</Text>
            </View>
          </View>
        ))}
        {filteredRecent.length === 0 ? (
          <Text style={styles.emptySearchText}>No recent activity matched your search.</Text>
        ) : null}
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  headerBlock: {
    marginBottom: spacing.sm,
  },
  heroCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  headerInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  heroValue: {
    ...typography.heading,
    color: colors.primary,
  },
  heroSubValue: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  title: {
    ...typography.title,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  searchInputFlex: {
    flex: 1,
  },
  clearSearchButton: {
    minHeight: 44,
    minWidth: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  clearSearchLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  emptySearchText: {
    ...typography.caption,
    color: colors.textSecondary,
    paddingVertical: spacing.sm,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  syncErrorBox: {
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: spacing.sm,
    padding: spacing.sm,
    backgroundColor: colors.surface,
  },
  syncError: {
    ...typography.caption,
    color: colors.danger,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  metricCard: {
    width: '48%',
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    minHeight: 96,
    justifyContent: 'space-between',
  },
  metricLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  metricValue: {
    ...typography.heading,
    color: colors.textPrimary,
  },
  sectionCard: {
    backgroundColor: colors.surface,
    borderRadius: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.heading,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  activityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingVertical: spacing.md,
  },
  activityLeft: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  activityRight: {
    alignItems: 'flex-end',
  },
  activityName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  activityMeta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  activityStatus: {
    ...typography.caption,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 52,
    textAlign: 'center',
  },
  activitySource: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  activityTime: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
});
