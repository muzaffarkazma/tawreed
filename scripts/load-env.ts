// Loads .env for command-line scripts (Next.js loads it by itself). Existing environment variables win.
try { process.loadEnvFile('.env'); } catch { /* no .env file: rely on the environment */ }
