import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
    darkMode: "class",
    content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
  	extend: {
  		fontFamily: {
  			sora: ['Sora', 'sans-serif'],
  			epilogue: ['Epilogue', 'Sora', 'sans-serif'],
  			manrope: ['Manrope', 'Sora', 'sans-serif'],
  		},
  		colors: {
  			// E-Gabon Prime Design Tokens
  			sidebar: '#111111',
  			orange: {
  				DEFAULT: '#f07020',
  				dark: '#d96500',
  				light: '#fff4e8',
  			},
  			background: '#f8f8f8',
  			surface: '#ffffff',
  			border: {
  				DEFAULT: '#e5e5e5',
  				dark: '#d4d4d4',
  			},
  			text: {
  				primary: '#111111',
  				secondary: '#555555',
  				muted: '#888888',
  			},
  			success: '#16a34a',
  			danger: '#dc2626',
  			info: '#2563eb',
  			warning: '#d97706',
  			purple: '#7c3aed',
  			sky: '#0891b2',
  			// Shadcn default colors (keep for compatibility)
  			card: {
  				DEFAULT: 'hsl(var(--card))',
  				foreground: 'hsl(var(--card-foreground))'
  			},
  			popover: {
  				DEFAULT: 'hsl(var(--popover))',
  				foreground: 'hsl(var(--popover-foreground))'
  			},
  			primary: {
  				DEFAULT: 'hsl(var(--primary))',
  				foreground: 'hsl(var(--primary-foreground))'
  			},
  			secondary: {
  				DEFAULT: 'hsl(var(--secondary))',
  				foreground: 'hsl(var(--secondary-foreground))'
  			},
  			muted: {
  				DEFAULT: 'hsl(var(--muted))',
  				foreground: 'hsl(var(--muted-foreground))'
  			},
  			accent: {
  				DEFAULT: 'hsl(var(--accent))',
  				foreground: 'hsl(var(--accent-foreground))'
  			},
  			destructive: {
  				DEFAULT: 'hsl(var(--destructive))',
  				foreground: 'hsl(var(--destructive-foreground))'
  			},
  			input: 'hsl(var(--input))',
  			ring: 'hsl(var(--ring))',
  			chart: {
  				'1': 'hsl(var(--chart-1))',
  				'2': 'hsl(var(--chart-2))',
  				'3': 'hsl(var(--chart-3))',
  				'4': 'hsl(var(--chart-4))',
  				'5': 'hsl(var(--chart-5))'
  			}
  		},
  		borderRadius: {
  			lg: 'var(--radius)',
  			md: 'calc(var(--radius) - 2px)',
  			sm: 'calc(var(--radius) - 4px)'
  		},
  		boxShadow: {
  			'orange': '0 4px 12px rgba(240, 112, 32, 0.2)',
  			'orange-lg': '0 2px 10px rgba(240, 112, 32, 0.22)',
  			'card': '0 20px 40px rgba(26, 28, 28, 0.06)',
  		},
  		spacing: {
  			'54': '13.5rem', // Top bar height
  		},
  		maxWidth: {
  			'128': '32rem', // 512px
  			'480': '30rem', // 480px
  		},
  		fontSize: {
  			'8.5': ['0.531rem', { lineHeight: '1rem' }], // 8.5px
  			'9': ['0.5625rem', { lineHeight: '1rem' }], // 9px
  			'10': ['0.625rem', { lineHeight: '1rem' }],
  			'11': ['0.6875rem', { lineHeight: '1rem' }],
  			'13.5': ['0.84375rem', { lineHeight: '1.25rem' }],
  		},
  		letterSpacing: {
  			'widest-xl': '0.15em', // 2.5px
  			'wide-lg': '0.12em', // 2px
  			'wide-md': '0.09em', // 1.5px
  		}
  	}
  },
  plugins: [tailwindcssAnimate],
};
export default config;
