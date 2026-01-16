import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		screens: {
			'xs': '475px',
			'sm': '640px', 
			'md': '768px',
			'lg': '1024px',
			'xl': '1280px',
			'2xl': '1536px',
		},
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			gridTemplateColumns: {
				'13': 'repeat(13, minmax(0, 1fr))',
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
					glow: 'hsl(var(--primary-glow))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))',
					glow: 'hsl(var(--accent-glow))'
				},
				success: {
					DEFAULT: 'hsl(var(--success))',
					foreground: 'hsl(var(--success-foreground))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warning))',
					foreground: 'hsl(var(--warning-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				'pulse-glow': {
					'0%, 100%': {
						boxShadow: '0 0 20px hsl(var(--primary) / 0.4)'
					},
					'50%': {
						boxShadow: '0 0 40px hsl(var(--primary) / 0.8)'
					}
				},
				'countdown': {
					'0%': {
						transform: 'scale(1)',
						color: 'hsl(var(--success))'
					},
					'50%': {
						transform: 'scale(1.1)',
						color: 'hsl(var(--warning))'
					},
					'100%': {
						transform: 'scale(1)',
						color: 'hsl(var(--destructive))'
					}
				},
				'bid-success': {
					'0%': {
						transform: 'scale(1)',
						backgroundColor: 'hsl(var(--accent))'
					},
					'50%': {
						transform: 'scale(1.05)',
						backgroundColor: 'hsl(var(--accent-glow))'
					},
					'100%': {
						transform: 'scale(1)',
						backgroundColor: 'hsl(var(--accent))'
					}
				},
				'timer-urgent': {
					'0%': {
						transform: 'scale(1)',
						boxShadow: '0 0 20px hsl(var(--destructive) / 0.5)'
					},
					'50%': {
						transform: 'scale(1.05)',
						boxShadow: '0 0 30px hsl(var(--destructive) / 0.8)'
					},
					'100%': {
						transform: 'scale(1)',
						boxShadow: '0 0 20px hsl(var(--destructive) / 0.5)'
					}
				},
			'timer-warning': {
				'0%': {
					boxShadow: '0 0 15px hsl(var(--warning) / 0.4)'
				},
				'100%': {
					boxShadow: '0 0 25px hsl(var(--warning) / 0.6)'
				}
			},
			'bar-grow': {
				'0%': {
					width: '0%',
					opacity: '0.5'
				},
				'100%': {
					width: 'var(--bar-width)',
					opacity: '1'
				}
			}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				'countdown': 'countdown 1s ease-in-out infinite',
			'bid-success': 'bid-success 0.6s ease-out',
			'timer-urgent': 'timer-urgent 0.8s ease-in-out infinite',
			'timer-warning': 'timer-warning 1s ease-in-out infinite alternate',
			'bar-grow': 'bar-grow 0.6s ease-out forwards'
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-accent': 'var(--gradient-accent)',
				'gradient-hero': 'var(--gradient-hero)'
			},
			boxShadow: {
				'elegant': 'var(--shadow-elegant)',
				'glow': 'var(--shadow-glow)',
				'card': 'var(--shadow-card)'
			},
			transitionProperty: {
				'smooth': 'var(--transition-smooth)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;
