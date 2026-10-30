# Re-Du — home page redesign

A redesigned home page for [reduplastic.com](https://www.reduplastic.com/): Re-Du turns hard-to-recycle PET waste, from colored bottles and film to post-consumer carpet, into W2V™ Monomer (BHET) and W2V™ PET.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build in dist/
npm run preview  # serve the build
```

`package.json` overrides `rollup` with `@rollup/wasm-node`. Some Windows machines block Rollup's native `.node` addon through Application Control; the WebAssembly build avoids it.

## What's on the page

| Section | Notes |
| --- | --- |
| Loader | Rolling 000–100 counter tied to real asset loading (images, fonts, the WebGL chunk) |
| Hero | WebGL particle field: coloured PET waste flakes reassemble into a BHET molecule as you scroll |
| Process | Horizontal pinned scroll on desktop, stacking sticky cards on mobile |
| Audience | "For waste producers" / "For BHET & PET users" cards with 3D tilt |
| **Carpet** | Second beachhead: market stats, 4-step carpet → W2V™ Monomer story, lab results, scale-up timeline, partner CTA |
| Plants | Modular regional plants and development stage |
| Proof, News, CTA, Footer | Counters, news cards, contact calls to action |

Only the home page is redesigned. Nav links for About, the full process page, news and contact point to the live site.

## Stack

- [Vite](https://vitejs.dev/) for dev server and build
- [three.js](https://threejs.org/) for the hero particles, loaded as a separate chunk
- [GSAP](https://gsap.com/) + ScrollTrigger for scroll animation
- [Lenis](https://lenis.darkroom.engineering/) for smooth scrolling

Respects `prefers-reduced-motion`. Images in `public/img` come from the live Re-Du site.

## Files

```
index.html        markup for every section
src/style.css     brand tokens, layout, responsive rules
src/main.js       loader, scroll animations, cursor, menu, mobile motion
src/hero-gl.js    WebGL waste → molecule particle system
public/img/       site photography
```
