/**
 * Guards against one specific, repeated mistake: an author `display` rule beats
 * the UA stylesheet's `[hidden]`, so setting `el.hidden = true` on an element
 * that a rule gives a `display` to does nothing at all.
 *
 * It has happened three times in this popup (`.blk`, `#tokenbody`, `.search`),
 * each time as a "why is that still on screen" bug with no error anywhere. This
 * finds it by reading what the code actually hides rather than by remembering.
 *
 * Run: npm run audit:hidden
 */

import { readFileSync } from "node:fs";

const css = readFileSync("src/popup/popup.css", "utf8");
const ts = readFileSync("src/popup/popup.ts", "utf8");
const html = readFileSync("src/popup/index.html", "utf8");

/** Handles the code assigns `.hidden` to. */
const hidden = new Set([...ts.matchAll(/\$(\w+)\.hidden\s*=/g)].map((m) => m[1]));

/** Handle → the selector it was looked up with. */
const selectorOf = {};
for (const m of ts.matchAll(/const \$(\w+) = document\.(?:getElementById\("([^"]+)"\)|querySelector\("([^"]+)"\))/g)) {
	selectorOf[m[1]] = m[2] ? `#${m[2]}` : m[3];
}

function classesOn(selector) {
	if (!selector.startsWith("#")) return [selector.replace(/^\./, "")];

	const tag = html.match(new RegExp(`<[^>]*id="${selector.slice(1)}"[^>]*>`));
	const attr = tag?.[0].match(/class="([^"]+)"/);
	return attr ? attr[1].split(/\s+/) : [];
}

function declaresDisplay(selector) {
	const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return new RegExp(`${escaped}\\s*\\{[^}]*display\\s*:`).test(css);
}

const problems = [];

for (const handle of hidden) {
	const selector = selectorOf[handle];
	if (!selector) {
		problems.push(`$${handle}: hidden is assigned but the lookup could not be found — check by hand`);
		continue;
	}

	const candidates = [selector, ...classesOn(selector).map((name) => `.${name}`)];
	const risky = candidates.filter(declaresDisplay);
	const guarded = candidates.some((candidate) => css.includes(`${candidate}[hidden]`));

	if (risky.length && !guarded) {
		problems.push(`$${handle} (${selector}): ${risky.join(", ")} sets display, and no [hidden] guard exists — hiding it will silently do nothing`);
	}
}

if (problems.length) {
	console.error(`✖ ${problems.length} element(s) cannot actually be hidden:\n`);
	for (const problem of problems) console.error(`  ${problem}`);
	console.error(`\nAdd a rule like \`.thing[hidden] { display: none }\`.`);
	process.exit(1);
}

console.log(`✓ all ${hidden.size} hidden-toggled elements can actually be hidden`);
