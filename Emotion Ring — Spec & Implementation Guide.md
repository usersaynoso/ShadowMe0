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

The mask creates a clean ring with sharp edges that surrounds the avatar.

⸻

3. Conic gradient for segmented colors

/* attach once after DOM ready */
document.querySelectorAll('.avatar-ring').forEach(initRing);

function initRing(wrapper){
  const emotions = JSON.parse(wrapper.dataset.emotions);   // [{name,color},…]
  const ring = wrapper.querySelector('.ring');

  /* Build the conic gradient with sharp color segments */
  if (emotions.length === 1) {
    // For a single emotion, use a solid color
    ring.style.setProperty('--gradient', emotions[0].color);
  } else {
    // For multiple emotions, create a clean segmented ring
    let gradientString = 'conic-gradient(';
    
    const step = 100 / emotions.length;
    emotions.forEach((emotion, index) => {
      const startPercent = index * step;
      const endPercent = (index + 1) * step;
      
      // Add sharp color transitions
      gradientString += `${emotion.color} ${startPercent}%, ${emotion.color} ${endPercent}%`;
      
      // Add comma if not the last element
      if (index < emotions.length - 1) {
        gradientString += ', ';
      }
    });
    
    gradientString += ')';
    ring.style.setProperty('--gradient', gradientString);
  }
}

Key idea: The colors form a clean segmented ring with each emotion having an equal area.

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
≥2	conic-gradient	360° / n per emotion

⸻

Result

You now have a clean, modern emotion ring that displays all selected emotions with equal prominence. The simplified design with distinct color segments provides clear visual feedback about the user's emotional state. The avatar and ring can be clicked to navigate to the user's profile, providing a seamless and intuitive user experience in the Shadow Me application. 