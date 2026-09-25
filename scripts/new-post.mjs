// Usage: npm run new-post -- "My Post Title"
import { writeFileSync, existsSync } from 'node:fs';

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('usage: npm run new-post -- "My Post Title"');
  process.exit(1);
}
const slug = title
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const file = `src/content/blog/${slug}.mdx`;
if (existsSync(file)) {
  console.error(`${file} already exists`);
  process.exit(1);
}
const today = new Date().toISOString().slice(0, 10);
writeFileSync(
  file,
  `---
title: '${title.replace(/'/g, "''")}'
description: ''
date: ${today}
tags: []
draft: true
---

Intro goes here. Components available without importing: Terminal, Runner, Callout, Spoiler.
See src/content/blog/how-to-follow-along.mdx for examples.
`,
);
console.log(`created ${file} (draft: true — flip it to publish)`);
