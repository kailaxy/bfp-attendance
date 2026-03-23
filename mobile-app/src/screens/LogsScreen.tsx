import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, ErrorState, LoadingState } from '../components';
import { useLogsData } from '../hooks';
import { spacing, typography, type AppColors, useAppTheme } from '../theme';
import type { ApiErrorPayload, AttendanceLogEntry } from '../types';

type LogsSourceMode = 'all' | 'raw' | 'archive';

const asDisplay = (value: string | undefined, fallback: string): string => {
  const text = String(value || '').trim();
  return text || fallback;
};

const toDisplayName = (entry: AttendanceLogEntry): string => {
  const firstName = asDisplay(entry.firstName, '');
  const lastName = asDisplay(entry.lastName, '');
  const rank = asDisplay(entry.rank, '');

  if (firstName && lastName) {
    return [rank, lastName, firstName].filter(Boolean).join(' ').trim();
  }

  return asDisplay(entry.name, 'Unknown Personnel');
};

const formatSource = (source: string | undefined): string => {
  const value = String(source || '').trim().toLowerCase();
  if (value === 'raw') return 'RAW';
  if (value === 'archive') return 'ARCHIVE';
  return 'UNKNOWN';
};

const getStatusColor = (status: string | undefined, colors: AppColors): string => {
  const value = String(status || '').trim().toUpperCase();
  if (value === 'IN' || value === 'ON-DUTY' || value === 'ONDUTY') return colors.success;
  if (value === 'OUT' || value === 'OFF-DUTY' || value === 'OFFDUTY') return colors.warning;
  return colors.textSecondary;
};

const getStableKey = (item: AttendanceLogEntry, index: number): string => {
  const id = String(item.id || '').trim();
  if (id) return id;
  const personnel = asDisplay(item.personnelId, 'no-id');
  const timestamp = asDisplay(item.timestamp, 'no-time');
  return `${personnel}-${timestamp}-${index}`;
};

const toTimeValue = (timestamp: string | undefined): number => {
  const parsed = new Date(String(timestamp || '')).getTime();
  return Number.isNaN(parsed) ? -1 : parsed;
};

const ensureTimestampDesc = (items: AttendanceLogEntry[]): AttendanceLogEntry[] => {
  return [...items].sort((a, b) => toTimeValue(b.timestamp) - toTimeValue(a.timestamp));
};

const getDeterministicLogsError = (error: ApiErrorPayload | null): string => {
  if (!error) {
    return 'Unable to load attendance logs. Please try again.';
  }

  const code = String(error.code || '').trim().toUpperCase();

  if (code === 'CONFIG_ERROR') {
    return 'Logs API is not configured. Please contact the administrator.';
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return 'Cannot reach attendance server right now. Please retry.';
  }

  if (code === 'HTTP_ERROR' || code === 'INTERNAL_ERROR') {
    return 'Attendance logs request failed on server. Please retry.';
  }

  return asDisplay(error.message, 'Unable to load attendance logs. Please try again.');
};

const LogsListItem = memo(({ item, colors, styles }: { item: AttendanceLogEntry; colors: AppColors; styles: ReturnType<typeof createStyles> }) => {
  const displayName = toDisplayName(item);

  return (
    <View style={styles.itemCard}>
      <View style={styles.itemHeader}>
        <Text style={styles.itemSource}>{formatSource(item.source)}</Text>
        <Text style={[styles.itemStatus, { color: getStatusColor(item.status, colors) }]}>
          {asDisplay(item.status, 'Unknown')}
        </Text>
      </View>
      <Text style={styles.itemName}>{displayName}</Text>
      <Text style={styles.itemMeta}>Personnel ID: {asDisplay(item.personnelId, 'N/A')}</Text>
      <Text style={styles.itemMeta}>Unit: {asDisplay(item.unit, 'N/A')}</Text>
      <Text style={styles.itemMeta}>Timestamp: {asDisplay(item.timestamp, 'N/A')}</Text>
    </View>
  );
});

export const LogsScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    isRefreshing,
    error: errorPayload,
    refresh,
  } = useLogsData();
  const [sourceMode, setSourceMode] = useState<LogsSourceMode>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {};
    }, [refresh])
  );

  const handleSwitchMode = useCallback((mode: LogsSourceMode) => {
    setSourceMode(mode);
  }, []);

  const renderLogItem = useCallback(({ item }: { item: AttendanceLogEntry }) => {
    return <LogsListItem item={item} colors={colors} styles={styles} />;
  }, [colors, styles]);

  const handleRetry = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const logs = useMemo(() => {
    const sorted = ensureTimestampDesc(data);
    if (sourceMode === 'all') {
      return sorted;
    }

    return sorted.filter((entry) => String(entry.source || '').trim().toLowerCase() === sourceMode);
  }, [data, sourceMode]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((item) => {
      const haystack = [
        asDisplay(item.id, ''),
        toDisplayName(item),
        asDisplay(item.firstName, ''),
        asDisplay(item.lastName, ''),
        asDisplay(item.personnelId, ''),
        asDisplay(item.unit, ''),
        asDisplay(item.status, ''),
        asDisplay(item.source, ''),
        asDisplay(item.timestamp, ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, searchQuery]);

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Logs</Text>
        <Text style={styles.subtitle}>Attendance logs</Text>
        <Text style={styles.caption}>Order: newest to oldest (timestamp-desc)</Text>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Entries</Text>
          <Text style={styles.metaValue}>{filteredLogs.length}</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search logs"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, styles.searchInputFlex]}
          />
          {searchQuery.trim().length > 0 ? (
            <Pressable style={styles.clearSearchButton} onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchLabel}>X</Text>
            </Pressable>
          ) : null}
        </View>
        <Pressable style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonLabel}>Refresh logs</Text>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <Pressable
          style={[styles.filterButton, sourceMode === 'all' ? styles.filterButtonActive : null]}
          onPress={() => handleSwitchMode('all')}
        >
          <Text
            style={[styles.filterButtonLabel, sourceMode === 'all' ? styles.filterButtonLabelActive : null]}
          >
            All
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, sourceMode === 'raw' ? styles.filterButtonActive : null]}
          onPress={() => handleSwitchMode('raw')}
        >
          <Text
            style={[styles.filterButtonLabel, sourceMode === 'raw' ? styles.filterButtonLabelActive : null]}
          >
            Raw
          </Text>
        </Pressable>
        <Pressable
          style={[styles.filterButton, sourceMode === 'archive' ? styles.filterButtonActive : null]}
          onPress={() => handleSwitchMode('archive')}
        >
          <Text
            style={[
              styles.filterButtonLabel,
              sourceMode === 'archive' ? styles.filterButtonLabelActive : null,
            ]}
          >
            Archive
          </Text>
        </Pressable>
      </View>

      <View style={styles.contentArea}>
        {isLoading ? (
          <View style={styles.stateContainer}>
            <LoadingState message="Loading attendance logs..." />
          </View>
        ) : errorPayload ? (
          <View style={styles.stateContainer}>
            <ErrorState
              title="Failed to load logs"
              message={getDeterministicLogsError(errorPayload)}
              actionLabel="Retry"
              onAction={handleRetry}
            />
          </View>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No attendance logs"
            message="No entries found for the selected source mode."
            actionLabel="Refresh"
            onAction={handleRefresh}
          />
        ) : filteredLogs.length === 0 ? (
          <EmptyState
            title="No matching logs"
            message="Try a different search keyword."
            actionLabel="Refresh"
            onAction={handleRefresh}
          />
        ) : (
          <FlatList
            data={filteredLogs}
            keyExtractor={getStableKey}
            renderItem={renderLogItem}
            contentContainerStyle={styles.listContent}
            style={styles.list}
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            removeClippedSubviews
            initialNumToRender={10}
            maxToRenderPerBatch={8}
            windowSize={7}
            updateCellsBatchingPeriod={50}
          />
        )}
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  headerBlock: {
    marginBottom: spacing.sm,
  },
  headerCard: {
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.surface,
    padding: spacing.lg,
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
    minHeight: 44,
    paddingHorizontal: spacing.md,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
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
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  filterButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
    justifyContent: 'center',
  },
  filterButtonActive: {
    borderColor: colors.primary,
  },
  filterButtonLabel: {
    ...typography.body,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterButtonLabelActive: {
    color: colors.primary,
  },
  meta: {
    ...typography.body,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  metaLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  metaValue: {
    ...typography.heading,
    color: colors.primary,
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  contentArea: {
    flex: 1,
    marginTop: spacing.md,
  },
  refreshButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  refreshButtonLabel: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
  stateContainer: {
    flex: 1,
  },
  loadingHint: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  itemCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  itemSource: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemStatus: {
    ...typography.caption,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  itemName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
  },
  itemMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
