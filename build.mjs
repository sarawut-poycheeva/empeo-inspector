import * as esbuild from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

const watch = process.argv.includes("--watch");
const outdir = "dist";

await rm(outdir, { recursive: true, force: true });
await mkdir(`${outdir}/popup`, { recursive: true });

const options = {
	entryPoints: { "popup/popup": "src/popup/popup.ts" },
	outdir,
	bundle: true,
	format: "iife",
	target: "chrome111",
	logLevel: "info",
};

async function copyStatic() {
	await cp("manifest.json", `${outdir}/manifest.json`);
	await cp("src/popup/index.html", `${outdir}/popup/index.html`);
	await cp("src/popup/popup.css", `${outdir}/popup/popup.css`);
}

if (watch) {
	const ctx = await esbuild.context(options);
	await ctx.watch();
	await copyStatic();
	console.log("watching…");
} else {
	await esbuild.build(options);
	await copyStatic();
}