# personal-website

Simple, old-school portfolio + blog built with [Astro](https://astro.build) and MDX.

## Quick start

```sh
npm install
npm run dev        # http://localhost:4321
npm run build      # static output in dist/
```

## Make it yours

| What | Where |
| --- | --- |
| Name, bio, roles, skills, social links | `src/site.config.ts` |
| Projects | `src/data/projects.ts` |
| Deployed URL (RSS/sitemap) | `site` in `astro.config.mjs` |
| Colors / fonts | `:root` in `src/styles/global.css` |

## Writing posts

```sh
npm run new-post -- "My Post Title"   # creates a draft in src/content/blog/
```

Posts are `.mdx`. These components work in any post without importing
(see `src/content/blog/how-to-follow-along.mdx` for live examples):

- `<Terminal user="kali" host="box" code={`...`} />`: a terminal session. Lines starting `$ ` / `# ` are commands (each gets a copy button); `[+] [-] [!] [*]` output lines are colored.
- `<Runner lang="js|python" title="x.py" code={`...`} />`: an editable, runnable cell. JS runs in a killable Web Worker; Python runs via Pyodide, and Python cells on a page share state.
- `<Callout type="note|tip|warning|danger" title="...">...</Callout>`
- `<Spoiler label="hint 1">...</Spoiler>`: collapsible hint or solution.
- Fenced code blocks get a header and a copy button; add `title="file.py"` after the language to show a filename.

Frontmatter: `title`, `description`, `date`, `tags`, optional `difficulty` (beginner/intermediate/advanced), `requirements` (list), `draft`.

## Deploy

`.github/workflows/deploy.yml` deploys to GitHub Pages on push. In the repo settings, set **Pages → Source** to **GitHub Actions**.
If the site lives at `https://<user>.github.io/<repo>/`, set `base: '/<repo>'` in `astro.config.mjs`.
