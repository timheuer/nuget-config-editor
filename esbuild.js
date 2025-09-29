const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');
const fs = require('fs');
const path = require('path');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// Extension host bundle
	const hostCtx = await esbuild.context({
		entryPoints: ['src/extension.ts'],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	// Webview bundle (browser platform)
	const webviewCtx = await esbuild.context({
		entryPoints: ['src/webview/main.ts'],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		platform: 'browser',
		outfile: 'dist/webview/main.js',
		logLevel: 'silent',
		plugins: [esbuildProblemMatcherPlugin],
	});

	function copyCodicons() {
		// Copy codicons css and font into dist/webview so they are packaged in the VSIX
		const srcDir = path.join(__dirname, 'node_modules', '@vscode', 'codicons', 'dist');
		const outDir = path.join(__dirname, 'dist', 'webview');
		if (!fs.existsSync(outDir)) {
			fs.mkdirSync(outDir, { recursive: true });
		}
		const files = ['codicon.css', 'codicon.ttf'];
		for (const f of files) {
			const from = path.join(srcDir, f);
			const to = path.join(outDir, f);
			try {
				if (fs.existsSync(from)) {
					fs.copyFileSync(from, to);
					console.log(`[build] copied ${f} to dist/webview`);
				} else {
					console.warn(`[build] ${from} not found`);
				}
			} catch (err) {
				console.error(`[build] failed copying ${f}:`, err);
			}
		}
	}

	if (watch) {
		await hostCtx.watch();
		await webviewCtx.watch();
		// Ensure codicons are available in watch mode
		copyCodicons();
	} else {
		await hostCtx.rebuild();
		await webviewCtx.rebuild();
		// Copy codicons into the output folder so VSIX includes them
		copyCodicons();
		await hostCtx.dispose();
		await webviewCtx.dispose();
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
