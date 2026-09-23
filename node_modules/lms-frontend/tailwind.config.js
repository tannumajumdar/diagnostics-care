/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      /**
       * The type scale, one step up from Tailwind's default.
       *
       * The screens are read across a counter, often standing, on whatever
       * monitor the centre already owned - and at 12px a receptionist was
       * leaning in to read a patient's name. Every size is about a tenth
       * larger than stock, so the whole interface grows together and nothing
       * that was set against something else is now out of step with it.
       *
       * The printed bill is not on this scale: BillPrint and its siblings
       * size every line in absolute px against a sheet measured in
       * millimetres, so the stationery keeps coming off the printer exactly
       * as it did.
       */
      fontSize: {
        xs: ['13px', '18px'],
        sm: ['15px', '21px'],
        base: ['17.5px', '26px'],
        lg: ['20px', '28px'],
        xl: ['22px', '30px'],
        '2xl': ['26px', '34px'],
        '3xl': ['33px', '39px'],
        '4xl': ['40px', '44px'],
        '5xl': ['53px', '1'],
        '6xl': ['66px', '1'],
        '7xl': ['79px', '1'],
        '8xl': ['106px', '1'],
        '9xl': ['141px', '1'],
      },
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
    },
  },
  plugins: [],
};

