#!/usr/bin/env node
// bead laporta-beads-058d4 / worker: 全フォーム入力に id/name が付いているかを機械検証する。
// JSXのattrs内には `=>` や文字列中の `>` が現れるため、brace/quote深度を見て閉じ `>` を判定する。
import fs from 'node:fs';

const TAGS = ['input', 'select', 'textarea'];

function tagBodies(src) {
  const out = [];
  const re = new RegExp(`<(${TAGS.join('|')})(?=[\\s/>])`, 'g');
  let m;
  while ((m = re.exec(src)) !== null) {
    let i = re.lastIndex;
    let depth = 0, quote = null;
    for (; i < src.length; i++) {
      const c = src[i];
      if (quote) {
        if (c === quote && src[i - 1] !== '\\') quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ tag: m[1], attrs: src.slice(re.lastIndex, i), index: m.index });
  }
  return out;
}

let total = 0;
for (const f of process.argv.slice(2)) {
  const src = fs.readFileSync(f, 'utf8');
  for (const { tag, attrs, index } of tagBodies(src)) {
    if (/\bid\s*=/.test(attrs) || /\bname\s*=/.test(attrs)) continue;
    if (/\{\s*\.\.\./.test(attrs)) continue; // spread props may supply id/name
    const line = src.slice(0, index).split('\n').length;
    console.log(`${f}:${line}: <${tag}> missing id/name`);
    total++;
  }
}
console.log(`TOTAL_MISSING=${total}`);
process.exit(total === 0 ? 0 : 1);
