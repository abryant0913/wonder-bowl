# Assets

Drop your images here, then update the matching references in `index.html`.
Each slot currently shows a styled placeholder so the layout holds without images.

| File to add                  | Used in            | Notes                                                            |
|------------------------------|--------------------|------------------------------------------------------------------|
| `hero-darker-bowl.jpg`       | Hero               | High-res photo of the **Darker Bowl** (Deep Vitality recipe).    |
| `leo-story.jpg`              | Founder / Story    | Founder + Leo. Warm, candid, artisanal.                          |
| `ingredients.jpg` (optional) | Recipe dropdown    | Flat-lay of lentils, mushrooms, chickpea, carrots, squash, cranberries. |
| `favicon.png` (optional)     | Browser tab        | 512×512 recommended.                                             |
| `og-image.jpg` (optional)    | Social share       | 1200×630 for link previews.                                     |

## How to swap a placeholder for a real image

In `index.html`, find the element marked with a `data-asset` attribute or an
`ASSET:` comment (e.g. the hero `.hero__photo`). Replace the placeholder block
with an `<img>`:

```html
<img class="hero__photo" src="assets/hero-darker-bowl.jpg"
     alt="A bowl of WonderBowl's Deep Vitality recipe" />
```

Keep the same class so the styling (aspect ratio, rounding, shadow) carries over.
