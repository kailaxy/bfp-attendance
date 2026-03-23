export type AppColors = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  success: string;
  warning: string;
  danger: string;
  border: string;
};

export const lightColors: AppColors = {
  background: '#f8fafc',
  surface: '#ffffff',
  textPrimary: '#0f172a',
  textSecondary: '#475569',
  primary: '#2563eb',
  success: '#16a34a',
  warning: '#d97706',
  danger: '#dc2626',
  border: '#e2e8f0',
};

export const darkColors: AppColors = {
  background: '#020617',
  surface: '#0f172a',
  textPrimary: '#e2e8f0',
  textSecondary: '#94a3b8',
  primary: '#60a5fa',
  success: '#22c55e',
  warning: '#f59e0b',
  danger: '#f87171',
  border: '#1e293b',
};

export const colors = lightColors;
