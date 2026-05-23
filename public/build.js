const esbuild = require('esbuild');
const fs = require('fs');

// 1. Clean and prepare the dist directory
if (!fs.existsSync('./dist')) {
    fs.mkdirSync('./dist');
}
// Copy everything from public to dist (HTML, CSS, assets)
fs.cpSync('./public', './dist', { recursive: true });

// 2. Check if we are running in development mode
const isDev = process.argv.includes('--dev');

// 3. Define our Esbuild configuration
const buildOptions = {
    // THIS IS THE MAGIC: Multiple entry points!
    entryPoints: {
        'main': 'src/main.ts',                 // Outputs to dist/main.js
        'editor/app': 'src/editor/app.ts'      // Outputs to dist/editor/app.js
    },
    bundle: true,
    outdir: 'dist',
    format: 'esm',        // Outputs modern ES Modules for <script type="module">
    minify: !isDev,       // Minify only in production
    sourcemap: isDev,     // Source maps for easier debugging in dev
};

// 4. Run the build or start the dev server
async function run() {
    if (isDev) {
        // Watch mode + Local Server
        const ctx = await esbuild.context(buildOptions);
        await ctx.watch();

        const { port } = await ctx.serve({
            servedir: 'dist',
        });
        console.log(`🚀 Dev server running at http://localhost:${port}`);
        console.log(`➡️  Landing Page: http://localhost:${port}/index.html`);
        console.log(`➡️  Editor Page:  http://localhost:${port}/tutorial.html`);
    } else {
        // Standard production build
        await esbuild.build(buildOptions);
        console.log('✅ Production build complete!');
    }
}

run().catch(() => process.exit(1));