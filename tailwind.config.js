/** @type {import('tailwindcss').Config} */
export default {
	content: ['./src/**/*.{ts,tsx}'],
	theme: {
		extend: {
			colors: {
				rugby: {
					green: '#0a6b3a',
					dark: '#0a1a14',
				},
			},
		},
	},
	plugins: [],
};
