import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { spacing, typography, type AppColors, useAppTheme } from '../../theme';

type LoadingStateProps = {
  message?: string;
};

export const LoadingState = ({ message = 'Loading...' }: LoadingStateProps) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.title}>Please wait</Text>
        <Text style={styles.text}>{message}</Text>
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
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: spacing.md,
    backgroundColor: colors.surface,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  title: {
    marginTop: spacing.md,
    color: colors.textPrimary,
    ...typography.heading,
  },
  text: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    ...typography.body,
    textAlign: 'center',
  },
});
