import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, ErrorState, LoadingState } from '../components';
import { useLeavesData } from '../hooks';
import { spacing, typography, type AppColors, useAppTheme } from '../theme';
import type { ApiErrorPayload, LeaveEntry } from '../types';

const asDisplay = (value: string | undefined, fallback: string): string => {
  const text = String(value || '').trim();
  return text || fallback;
};

const parseDate = (value: string | undefined): Date | null => {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatDate = (value: string | undefined): string => {
  const date = parseDate(value);
  if (!date) {
    return '—';
  }

  return date.toLocaleDateString([], {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
};

const normalizeStatusLabel = (value: string | undefined): string => {
  const status = String(value || '').trim();
  return status || 'Unknown';
};

const getStatusColor = (value: string | undefined, colors: AppColors): string => {
  const status = String(value || '').trim().toUpperCase();

  if (status === 'APPROVED') return colors.success;
  if (status === 'PENDING') return colors.warning;
  if (status === 'REJECTED') return colors.danger;
  return colors.textSecondary;
};

const toStartTimeValue = (entry: LeaveEntry): number => {
  const date = parseDate(entry.startDate);
  return date ? date.getTime() : -1;
};

const sortLeaves = (items: LeaveEntry[]): LeaveEntry[] => {
  return [...items].sort((a, b) => toStartTimeValue(b) - toStartTimeValue(a));
};

const getDeterministicLeaveError = (error: ApiErrorPayload | null): string => {
  if (!error) {
    return 'Unable to load leave records. Please retry.';
  }

  const code = String(error.code || '').trim().toUpperCase();

  if (code === 'CONFIG_ERROR') {
    return 'Leave API is not configured. Please contact the administrator.';
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return 'Cannot reach attendance server right now. Please retry.';
  }

  if (code === 'HTTP_ERROR' || code === 'INTERNAL_ERROR') {
    return 'Leave request failed on server. Please retry.';
  }

  return asDisplay(error.message, 'Unable to load leave records. Please retry.');
};

export const LeaveScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    isRefreshing,
    error: errorPayload,
    refresh,
  } = useLeavesData();
  const [searchQuery, setSearchQuery] = useState('');

  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {};
    }, [refresh])
  );

  const handleRetry = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleRefresh = useCallback(() => {
    refresh();
  }, [refresh]);

  const filteredLeaves = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sortedData = sortLeaves(data);
    if (!query) return sortedData;

    return sortedData.filter((item) => {
      const haystack = [
        asDisplay(item.personnelName, ''),
        asDisplay(item.accountNumber, ''),
        asDisplay(item.rank, ''),
        asDisplay(item.leaveType, ''),
        asDisplay(item.reason, ''),
        asDisplay(item.status, ''),
        asDisplay(item.startDate, ''),
        asDisplay(item.endDate, ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [data, searchQuery]);

  const renderLeaveItem = useCallback(({ item }: { item: LeaveEntry }) => {
    return (
      <View style={styles.leaveCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardTitleWrap}>
            <Text style={styles.personnelName}>{asDisplay(item.personnelName, 'Unknown Personnel')}</Text>
            <Text style={styles.accountNumber}>ID: {asDisplay(item.accountNumber, 'N/A')}</Text>
          </View>
          <Text style={[styles.statusBadge, { color: getStatusColor(item.status, colors) }]}>
            {normalizeStatusLabel(item.status)}
          </Text>
        </View>

        <Text style={styles.detailText}>Type: {asDisplay(item.leaveType, 'Unspecified')}</Text>
        <Text style={styles.detailText}>
          Date: {formatDate(item.startDate)} - {formatDate(item.endDate)}
        </Text>
        <Text style={styles.detailText}>Reason: {asDisplay(item.reason, 'Not provided')}</Text>
      </View>
    );
  }, [colors, styles]);

  if (isLoading) {
    return <LoadingState message="Loading leave records..." />;
  }

  if (errorPayload) {
    return (
      <View style={styles.stateContainer}>
        <ErrorState
          title="Leave monitoring unavailable"
          message={getDeterministicLeaveError(errorPayload)}
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No leave records"
        message="No leave entries are available right now."
        actionLabel="Refresh"
        onAction={handleRefresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Leave</Text>
        <Text style={styles.subtitle}>Leave monitoring</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.caption}>Active leave records</Text>
          <Text style={styles.summaryValue}>{filteredLeaves.length}</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search leave records"
            placeholderTextColor={colors.textSecondary}
            style={[styles.searchInput, styles.searchInputFlex]}
          />
          {searchQuery.trim().length > 0 ? (
            <Pressable style={styles.clearSearchButton} onPress={() => setSearchQuery('')}>
              <Text style={styles.clearSearchLabel}>X</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      <FlatList
        data={filteredLeaves}
        keyExtractor={(item, index) => asDisplay(item.id, `${asDisplay(item.accountNumber, 'id')}-${index}`)}
        renderItem={renderLeaveItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.listEmptyContainer}>
            <Text style={styles.listEmptyText}>No leave records matched your search.</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
            progressBackgroundColor={colors.surface}
          />
        }
      />
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  stateContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
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
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
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
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  summaryRow: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  summaryValue: {
    ...typography.heading,
    color: colors.primary,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  listEmptyContainer: {
    paddingVertical: spacing.lg,
  },
  listEmptyText: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  leaveCard: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
  },
  cardTitleWrap: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  personnelName: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  accountNumber: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  statusBadge: {
    ...typography.caption,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    minWidth: 92,
    textAlign: 'center',
  },
  detailText: {
    ...typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
});
