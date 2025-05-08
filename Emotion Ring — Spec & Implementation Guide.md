Emotion Ring — Spec & Implementation Guide

(designed to match the look‑and‑feel in the reference image while scaling to an unlimited palette of emotions)

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
	3.	.ring – purely decorative gradient halo built in CSS.

⸻

2. Sizing & layout

.avatar-ring{
  --ring-thickness:   10px;      /* visible band width       */
  --ring-blur:        30px;      /* outer glow softness      */
  --ring-rotation:   120s;       /* full spin duration       */
  --ring-outer-glow:  20px;      /* outer fade to transparent */

  display:inline-block;
  position:relative;
}
.avatar{
  display:block;
  width:128px; height:128px;     /* any size -> ring adapts  */
  border-radius:50%;
  object-fit:cover;
}

/* gradient halo */
.ring{
  position:absolute;
  inset:calc(-1*var(--ring-thickness) - var(--ring-outer-glow));  /* bleed outside the avatar */
  border-radius:50%;
  pointer-events:none;                      /* mouse events handled in JS */
  --gradient: transparent;                  /* will be overwritten */
  background:var(--gradient);
  mask:
    radial-gradient(
      farthest-side, 
      transparent calc(100% - var(--ring-thickness) - var(--ring-outer-glow) * 2), 
      #000 calc(100% - var(--ring-thickness) - var(--ring-outer-glow)),
      #000 calc(100% - var(--ring-outer-glow)),
      transparent 100%
    );
  filter:blur( var(--ring-blur) )
          brightness(1.2)      /* gentle glow */
          saturate(1.4);
  animation:spin var(--ring-rotation) linear infinite;
}
@keyframes spin{from{transform:rotate(0)} to{transform:rotate(360deg)}}

The mask creates a ring with a gradual fade to transparent at both inner and outer edges, producing a soft radial glow effect that highlights all emotion colors simultaneously.

⸻

3. Unlimited‑colour gradient algorithm

/* attach once after DOM ready */
document.querySelectorAll('.avatar-ring').forEach(initRing);

function initRing(wrapper){
  const emotions = JSON.parse(wrapper.dataset.emotions);   // [{name,color},…]
  const ring = wrapper.querySelector('.ring');

  /* 3‑A  ─ build the conic‑gradient string */
  if (emotions.length === 1) {
    // For a single emotion, use a solid color
    ring.style.setProperty('--gradient', emotions[0].color);
  } else {
    // For multiple emotions, create a clockwise conic gradient
    let gradientString = 'conic-gradient(';
    
    const step = 100 / emotions.length;
    emotions.forEach((emotion, index) => {
      const startPercent = index * step;
      const endPercent = (index + 1) * step;
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

Key idea: The colors flow clockwise in order of the emotions provided, creating a radial color ring.

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
	•	Reduced‑motion: Respect prefers-reduced-motion; pause the spin if requested.
	•	Keyboard focus: Add focus‑ring support by turning each segment into an ARIA‑labelled <button> if full accessibility is needed.
	•	Colour contrast: Allow a darker inner‑shadow (box-shadow: inset 0 0 0 2px #0003) to keep avatars legible against bright halos.
	•	Batch rendering: Generate gradients server‑side for static exports (SVG) to lighten client CPU on long lists.
	• Responsive sizing: Adjust `--ring-thickness` and `--ring-outer-glow` values based on avatar size for consistent visual appearance across different dimensions.

⸻

Behaviour matrix

# emotions	Gradient formula	Segment size
1	radial-gradient(…) (solid)	100 %
2	linear-gradient(to right, …)	50 % left / right
≥3	conic-gradient(…) (see above)	360 ° / n

⸻

Result

You now have a halo that perfectly echoes the soft, radiant spectrum in the reference asset, yet gracefully scales to any count of emotions. The updated implementation provides a more visually appealing radial gradient effect, with colors smoothly fading at both inner and outer edges. The avatar and ring can be clicked to navigate to the user's profile, providing a seamless and intuitive user experience in the Shadow Me application. 