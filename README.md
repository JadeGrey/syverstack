# syverstack.com

Personal portfolio for **Sami Syverson** — AI engineer, Rust/Python builder, agent systems tinkerer.

Built with [Astro](https://astro.build) + [Three.js](https://threejs.org), styled with the nightcity-bloom cyberpunk theme.

## Stack

- **Framework:** Astro 5 (static output)
- **3D:** Three.js (WebGL shader background + interactive 3D objects)
- **Content:** MDX via Astro content collections
- **Hosting:** GitHub Pages (custom domain)
- **Fonts:** Orbitron, Exo 2, JetBrains Mono

## Pages

| Route | Content |
|-------|---------|
| `/` | Landing — hero, featured projects, skills |
| `/bio` | Bio — origin story, tech deep-dive, contact |
| `/projects` | All projects — full listing |
| `/projects/[slug]` | Individual project pages (MDX) |
| `/404` | Custom 404 |

## Development

```bash
npm run dev      # Start dev server
npm run build    # Build to dist/
npm run preview  # Preview built site
```

## Deploy

Static output in `dist/`. Push to `main` branch for GitHub Pages with CNAME record pointing to `syverstack.com`.

## Theme

nightcity-bloom — full cyberpunk intensity:
- Magenta (`#ff3b8c`) / Cyan (`#00f5ff`) accent palette
- Dark surface (`#05070d`)
- Hover glow interactions
- Noise overlay texture
- WebGL shader background with responsive 3D particle system
