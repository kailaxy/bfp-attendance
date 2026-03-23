/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#B42222',
          'primary-hover': '#8D1A1A',
          'primary-soft': '#FDECEC',
          secondary: '#12396A',
          'secondary-hover': '#0D2B51',
          'secondary-soft': '#EAF1FB',
          deep: '#0B2345',
          'deep-hover': '#091C36',
          accent: '#C49B2A',
          'accent-hover': '#A27E20',
          'accent-soft': '#F9F2DF',
        },
        surface: {
          canvas: '#EDF2FA',
          base: '#FFFFFF',
          muted: '#F5F8FD',
          elevated: '#FFFFFF',
          inverse: '#0B1624',
          border: '#D5DFEC',
        },
        text: {
          heading: '#10233A',
          body: '#23384F',
          muted: '#5B7088',
          inverse: '#F8FAFC',
        },
        status: {
          success: '#1D8A4A',
          'success-soft': '#EAF8F0',
          warning: '#AE7516',
          'warning-soft': '#FFF6E1',
          danger: '#B42318',
          'danger-soft': '#FFEDEC',
          info: '#1F6FB6',
          'info-soft': '#EAF3FC',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Segoe UI', 'sans-serif'],
        heading: ['Poppins', 'Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        display: ['2rem', { lineHeight: '2.5rem', fontWeight: '700' }],
        'heading-1': ['1.5rem', { lineHeight: '2rem', fontWeight: '700' }],
        'heading-2': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-3': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '600' }],
        body: ['0.9375rem', { lineHeight: '1.5rem', fontWeight: '400' }],
        meta: ['0.8125rem', { lineHeight: '1.125rem', fontWeight: '500' }],
      },
      spacing: {
        18: '4.5rem',
        22: '5.5rem',
        26: '6.5rem',
      },
      borderRadius: {
        panel: '0.75rem',
        control: '0.625rem',
        badge: '9999px',
      },
      boxShadow: {
        card: '0 2px 6px 0 rgba(11, 35, 69, 0.08), 0 10px 26px -16px rgba(11, 35, 69, 0.28)',
        elevated: '0 14px 30px -16px rgba(11, 35, 69, 0.35)',
        focus: '0 0 0 3px rgba(11, 46, 89, 0.25)',
      },
      ringColor: {
        focus: '#0B2E59',
      },
      transitionDuration: {
        160: '160ms',
      },
    },
  },
  plugins: [],
}
