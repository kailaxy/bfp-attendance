import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type AppColors, useAppTheme } from '../../theme';

type ErrorStateProps = {
  title?: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export const ErrorState = ({
  title = 'Something went wrong',
  message = 'Please try again.',
  actionLabel,
  onAction,
}: ErrorStateProps) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.badge}>ACTION REQUIRED</Text>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        {actionLabel && onAction ? (
          <Pressable style={styles.actionButton} onPress={onAction}>
            <Text style={styles.actionLabel}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const createStyles = (colors: AppColors) => StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
    backgroundColor: colors.background,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  badge: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.danger,
    ...typography.heading,
    textAlign: 'center',
  },
  message: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
  },
  actionButton: {
    marginTop: spacing.lg,
    backgroundColor: colors.primary,
    borderRadius: spacing.sm,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionLabel: {
    ...typography.body,
    color: colors.surface,
    fontWeight: '600',
  },
});
