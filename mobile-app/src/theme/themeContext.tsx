import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { useColorScheme } from 'react-native';
import type { Theme as NavigationTheme } from '@react-navigation/native';
import { darkColors, lightColors, type AppColors } from './colors';

const THEME_MODE_STORAGE_KEY = 'bfp.mobile.theme.mode.v1';

type ThemeMode = 'light' | 'dark' | 'system';

type ResolvedThemeMode = 'light' | 'dark';

type AppThemeContextValue = {
  mode: ThemeMode;
  resolvedMode: ResolvedThemeMode;
  colors: AppColors;
  isDarkMode: boolean;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  navigationTheme: NavigationTheme;
  statusBarStyle: 'light' | 'dark';
};

const AppThemeContext = createContext<AppThemeContextValue | undefined>(undefined);

const resolveMode = (mode: ThemeMode, systemScheme: string | null): ResolvedThemeMode => {
  if (mode === 'light' || mode === 'dark') {
    return mode;
  }

  return systemScheme === 'dark' ? 'dark' : 'light';
};

const parseStoredMode = (value: string | null): ThemeMode | null => {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'light' || normalized === 'dark' || normalized === 'system') {
    return normalized;
  }

  return null;
};

export const AppThemeProvider = ({ children }: PropsWithChildren) => {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadMode = async () => {
      try {
        const raw = await AsyncStorage.getItem(THEME_MODE_STORAGE_KEY);
        const parsed = parseStoredMode(raw);

        if (isMounted && parsed) {
          setModeState(parsed);
        }
      } finally {
        if (isMounted) {
          setIsHydrated(true);
        }
      }
    };

    void loadMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const resolvedMode = useMemo<ResolvedThemeMode>(() => {
    return resolveMode(mode, systemScheme);
  }, [mode, systemScheme]);

  const colors = useMemo(() => {
    return resolvedMode === 'dark' ? darkColors : lightColors;
  }, [resolvedMode]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    setModeState(nextMode);

    void AsyncStorage.setItem(THEME_MODE_STORAGE_KEY, nextMode).catch(() => {
      // Ignore persistence failures to avoid blocking UI interactions.
    });
  }, []);

  const toggleMode = useCallback(() => {
    const currentResolved = resolveMode(mode, systemScheme);
    const next: ThemeMode = currentResolved === 'dark' ? 'light' : 'dark';
    setMode(next);
  }, [mode, setMode, systemScheme]);

  const navigationTheme = useMemo<NavigationTheme>(() => {
    return {
      dark: resolvedMode === 'dark',
      colors: {
        primary: colors.primary,
        background: colors.background,
        card: colors.surface,
        text: colors.textPrimary,
        border: colors.border,
        notification: colors.warning,
      },
      fonts: {
        regular: { fontFamily: 'System', fontWeight: '400' },
        medium: { fontFamily: 'System', fontWeight: '500' },
        bold: { fontFamily: 'System', fontWeight: '700' },
        heavy: { fontFamily: 'System', fontWeight: '700' },
      },
    };
  }, [colors, resolvedMode]);

  const value = useMemo<AppThemeContextValue>(() => {
    return {
      mode,
      resolvedMode,
      colors,
      isDarkMode: resolvedMode === 'dark',
      setMode,
      toggleMode,
      navigationTheme,
      statusBarStyle: resolvedMode === 'dark' ? 'light' : 'dark',
    };
  }, [mode, resolvedMode, colors, setMode, toggleMode, navigationTheme]);

  if (!isHydrated) {
    return null;
  }

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
};

export const useAppTheme = (): AppThemeContextValue => {
  const context = useContext(AppThemeContext);

  if (!context) {
    throw new Error('useAppTheme must be used inside AppThemeProvider.');
  }

  return context;
};
