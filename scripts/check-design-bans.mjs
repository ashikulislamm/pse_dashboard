import fs from 'node:fs';
import path from 'node:path';

const SRC_DIR = path.resolve(process.cwd(), 'src');
const BANNED_PATTERN =
  /\b(bg-gradient-[a-z0-9-]+|from-[a-z0-9-]+|via-[a-z0-9-]+|to-\[|animate-(pulse|ping|bounce)|backdrop-[a-z0-9-]+|blur-[a-z0-9-]+|shadow-(lg|xl|2xl))\b/;

/**
 * Recursively scan files in src/ for DESIGN.md §2 / §13.2 banned classes.
 */
function walk(dir, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, results);
    } else if (/\.(ts|tsx|js|jsx|css)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

const files = walk(SRC_DIR);
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const match = line.match(BANNED_PATTERN);
    if (match) {
      violations.push({
        file: path.relative(process.cwd(), file),
        line: index + 1,
        token: match[0],
        text: line.trim(),
      });
    }
  });
}

if (violations.length > 0) {
  console.error('DESIGN.md §2 / §13.2 violation(s) found:');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line} -> banned class "${v.token}" in: ${v.text}`);
  }
  process.exit(1);
} else {
  console.log('Design system check passed: 0 banned utility classes found in src/.');
}
