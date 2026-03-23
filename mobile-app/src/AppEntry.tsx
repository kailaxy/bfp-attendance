import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text } from 'react-native';
import { AppThemeProvider, spacing, useAppTheme } from './theme';
import {
  DashboardScreen,
  LogsScreen,
  LeaveScreen,
  PersonnelScreen,
  ScannerScreen,
  SCREEN_KEYS,
} from './screens';

const Tab = createBottomTabNavigator();

const getTabIconName = (routeName: string): keyof typeof Ionicons.glyphMap => {
  switch (routeName) {
    case SCREEN_KEYS.dashboard:
      return 'grid';
    case SCREEN_KEYS.scanner:
      return 'scan';
    case SCREEN_KEYS.logs:
      return 'time';
    case SCREEN_KEYS.leave:
      return 'calendar';
    case SCREEN_KEYS.personnel:
      return 'people';
    default:
      return 'ellipse';
  }
};

const AppNavigator = () => {
  const { colors, navigationTheme, statusBarStyle, isDarkMode, toggleMode } = useAppTheme();

  return (
    <NavigationContainer theme={navigationTheme}>
      <StatusBar style={statusBarStyle} />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerTitleAlign: 'center',
          headerStyle: {
            backgroundColor: colors.surface,
          },
          headerTitleStyle: {
            color: colors.textPrimary,
            fontSize: 16,
            fontWeight: '700',
          },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textSecondary,
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
          },
          tabBarIcon: ({ color, size, focused }) => {
            const iconName = getTabIconName(route.name);
            return <Ionicons name={iconName} size={focused ? size + 1 : size} color={color} />;
          },
          tabBarStyle: {
            height: 68,
            paddingBottom: 8,
            paddingTop: 8,
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            borderTopWidth: 1,
          },
        })}
      >
        <Tab.Screen
          name={SCREEN_KEYS.dashboard}
          component={DashboardScreen}
          options={{
            headerRight: () => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Toggle dark mode"
                onPress={toggleMode}
                style={({ pressed }) => [
                  styles.themeToggle,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
              >
                <Ionicons
                  name={isDarkMode ? 'sunny' : 'moon'}
                  size={16}
                  color={colors.primary}
                />
                <Text style={[styles.themeToggleLabel, { color: colors.textPrimary }]}>
                  {isDarkMode ? 'Light' : 'Dark'}
                </Text>
              </Pressable>
            ),
          }}
        />
        <Tab.Screen name={SCREEN_KEYS.scanner} component={ScannerScreen} />
        <Tab.Screen name={SCREEN_KEYS.logs} component={LogsScreen} />
        <Tab.Screen name={SCREEN_KEYS.leave} component={LeaveScreen} />
        <Tab.Screen name={SCREEN_KEYS.personnel} component={PersonnelScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
};

export const AppEntry = () => {
  return (
    <AppThemeProvider>
      <AppNavigator />
    </AppThemeProvider>
  );
};

const styles = StyleSheet.create({
  themeToggle: {
    marginRight: spacing.md,
    minHeight: 36,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.xs,
  },
  themeToggleLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
});
