import { useCallback, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { EmptyState, ErrorState, LoadingState } from '../components';
import { usePersonnelData } from '../hooks';
import { spacing, typography, type AppColors, useAppTheme } from '../theme';
import type { ApiErrorPayload, PersonnelEntry } from '../types';

const asDisplay = (value: string | undefined, fallback: string): string => {
  const text = String(value || '').trim();
  return text || fallback;
};

const composeName = (entry: PersonnelEntry): string => {
  const full = [entry.rank, entry.lastName, entry.firstName, entry.middleName]
    .map((value) => asDisplay(value, ''))
    .filter(Boolean)
    .join(' ')
    .trim();

  return full || 'Unknown Personnel';
};

const sortPersonnel = (items: PersonnelEntry[]): PersonnelEntry[] => {
  return [...items].sort((a, b) => {
    const left = composeName(a).toUpperCase();
    const right = composeName(b).toUpperCase();
    return left.localeCompare(right);
  });
};

const getDeterministicPersonnelError = (error: ApiErrorPayload | null): string => {
  if (!error) {
    return 'Unable to load personnel records. Please retry.';
  }

  const code = String(error.code || '').trim().toUpperCase();

  if (code === 'CONFIG_ERROR') {
    return 'Personnel API is not configured. Please contact the administrator.';
  }

  if (code === 'NETWORK_ERROR' || code === 'TIMEOUT') {
    return 'Cannot reach attendance server right now. Please retry.';
  }

  if (code === 'HTTP_ERROR' || code === 'INTERNAL_ERROR') {
    return 'Personnel request failed on server. Please retry.';
  }

  return asDisplay(error.message, 'Unable to load personnel records. Please retry.');
};

export const PersonnelScreen = () => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    data,
    isLoading,
    isRefreshing,
    error: errorPayload,
    refresh,
  } = usePersonnelData();
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

  const filteredPersonnel = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sortedData = sortPersonnel(data);
    if (!query) return sortedData;

    return sortedData.filter((item) => {
      const haystack = [
        composeName(item),
        asDisplay(item.accountNumber, ''),
        asDisplay(item.rank, ''),
        asDisplay(item.designation, ''),
        asDisplay(item.unit, ''),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [data, searchQuery]);

  const renderPersonnelItem = useCallback(({ item }: { item: PersonnelEntry }) => {
    const hasPhoto = Boolean(String(item.photoUrl || '').trim());

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          {hasPhoto ? (
            <Image source={{ uri: String(item.photoUrl || '').trim() }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarFallbackText}>
                {String(item.firstName || '').trim().slice(0, 1).toUpperCase() ||
                  String(item.lastName || '').trim().slice(0, 1).toUpperCase() ||
                  '?'}
              </Text>
            </View>
          )}
          <View style={styles.cardHeaderText}>
            <Text style={styles.name}>{composeName(item)}</Text>
            <Text style={styles.meta}>Account: {asDisplay(item.accountNumber, 'N/A')}</Text>
          </View>
        </View>
        <Text style={styles.meta}>Designation: {asDisplay(item.designation, 'Unspecified')}</Text>
        <Text style={styles.meta}>Unit: {asDisplay(item.unit, 'Unassigned')}</Text>
      </View>
    );
  }, [styles]);

  if (isLoading) {
    return <LoadingState message="Loading personnel records..." />;
  }

  if (errorPayload) {
    return (
      <View style={styles.stateContainer}>
        <ErrorState
          title="Personnel unavailable"
          message={getDeterministicPersonnelError(errorPayload)}
          actionLabel="Retry"
          onAction={handleRetry}
        />
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <EmptyState
        title="No personnel records"
        message="No personnel entries are available right now."
        actionLabel="Refresh"
        onAction={handleRefresh}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerCard}>
        <Text style={styles.title}>Personnel</Text>
        <Text style={styles.subtitle}>List of personnel</Text>
        <View style={styles.summaryRow}>
          <Text style={styles.caption}>Total personnel</Text>
          <Text style={styles.summaryValue}>{filteredPersonnel.length}</Text>
        </View>
        <View style={styles.searchRow}>
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Search personnel"
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
        data={filteredPersonnel}
        keyExtractor={(item, index) => asDisplay(item.accountNumber, `personnel-${index}`)}
        renderItem={renderPersonnelItem}
        style={styles.list}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.listEmptyContainer}>
            <Text style={styles.listEmptyText}>No personnel matched your search.</Text>
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
    justifyContent: 'space-between',
    alignItems: 'center',
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
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  cardHeaderText: {
    flex: 1,
    marginLeft: spacing.md,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '700',
  },
  name: {
    ...typography.body,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
});
