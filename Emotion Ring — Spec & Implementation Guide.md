Emotion Ring — Spec & Implementation Guide

(designed for a clean, simple display of emotion colors in a single ring)

⸻

1. DOM structure

<div class="avatar-ring"          /* 1 */
     data-emotions='[
       {"name":"Hopeful","color":"#FF9B21"},
       {"name":"Calm","color":"#28C4B8"},
       {"name":"Wonder","color":"#715AFF"}
     ]'>
  <img class="avatar" src="user.jpg" alt="User avatar" />   <!-- 2 -->
  <div class="ring"></div>                                   <!-- 3 -->
</div>

	1.	.avatar‑ring – relative positioning anchor (can be a link for navigation).
	2.	.avatar – the face; can be any shape (circle or rounded‑square).
	3.	.ring – decorative color ring built in CSS.

⸻

2. Sizing & layout

.avatar-ring{
  --ring-thickness:   10px;      /* visible band width       */
  --ring-rotation:    0s;        /* rotation (0s for static) */

  display:inline-block;
  position:relative;
}
.avatar{
  display:block;
  width:128px; height:128px;     /* any size -> ring adapts  */
  border-radius:50%;
  object-fit:cover;
}

/* color ring */
.ring{
  position:absolute;
  inset:calc(-1*var(--ring-thickness));  /* bleed outside the avatar */
  border-radius:50%;
  pointer-events:none;
  --gradient: transparent;       /* will be overwritten */
  background:var(--gradient);
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--ring-thickness)), #000 0);
}

The mask creates a clean ring with fading edges that surrounds the avatar.

⸻

3. Conic gradient for segmented colors with smooth blending

In the final implementation, the ring uses a conic-gradient with smooth blending between adjacent colors. Each emotion color smoothly transitions into the next, creating a visually appealing and modern look while still giving each emotion equal prominence.

**React Implementation Example:**

```tsx
const generateGradient = (emotions: { color: string }[]) => {
  if (emotions.length === 0) return 'transparent';
  if (emotions.length === 1) {
    const color = emotions[0].color;
    return `radial-gradient(circle, ${color} 0%, ${color} 60%, transparent 100%)`;
  }
  const numEmotions = emotions.length;
  const fullCircle = 360;
  const segmentSize = fullCircle / numEmotions;
  let gradientParts: string[] = [];
  for (let i = 0; i < numEmotions; i++) {
    const currentColor = emotions[i].color;
    const nextColor = emotions[(i + 1) % numEmotions].color;
    const segmentStart = i * segmentSize;
    const segmentEnd = (i + 1) * segmentSize;
    const midPoint = segmentStart + (segmentSize / 2);
    const blendZone = segmentSize / 4;
    gradientParts.push(`${currentColor} ${segmentStart}deg`);
    if (numEmotions > 2) {
      gradientParts.push(`${currentColor} ${midPoint - blendZone}deg`);
      gradientParts.push(`${nextColor} ${midPoint + blendZone}deg`);
    }
    gradientParts.push(`${nextColor} ${segmentEnd}deg`);
  }
  return `conic-gradient(${gradientParts.join(', ')})`;
};
```

This function is used as the background for the ring. The ring thickness is customizable via a prop or CSS variable, and the mask ensures the ring fades to transparency at the edges.

**CSS for the ring:**

```css
.ring {
  position: absolute;
  inset: calc(-1*var(--ring-thickness));
  border-radius: 50%;
  pointer-events: none;
  background: var(--gradient);
  mask: radial-gradient(farthest-side, transparent calc(100% - var(--ring-thickness)), #000 0);
}
```

⸻

4. Profile Navigation

The avatar-ring can be wrapped in a link to navigate to the user's profile page:

```tsx
<Link href={`/profile/${user.id}`}>
  <a className="avatar-ring">
    {/* Ring content */}
  </a>
</Link>
```

This allows the whole avatar with its emotion ring to serve as a navigation element.

⸻

5. Accessibility & performance notes
	•	Colour contrast: Consider adding a thin white border to the avatar to separate it from the emotion ring.
	•	Responsive sizing: Adjust `--ring-thickness` based on avatar size for consistent visual appearance across different dimensions.

⸻

Behaviour matrix

# emotions	Gradient formula	Segment size
1	solid-color	100%
≥2	conic-gradient (with blending)	360° / n per emotion

⸻

Result

You now have a clean, modern emotion ring that displays all selected emotions with equal prominence and smooth transitions. The avatar and ring can be clicked to navigate to the user's profile, providing a seamless and intuitive user experience in the Shadow Me application. 