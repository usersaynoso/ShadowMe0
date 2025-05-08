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
  <div class="tooltip" role="tooltip" aria-hidden="true"></div><!-- 4 -->
</div>

	1.	.avatar‑ring – relative positioning anchor.
	2.	.avatar – the face; can be any shape (circle or rounded‑square).
	3.	.ring – purely decorative gradient halo built in CSS.
	4.	.tooltip – appears when the pointer enters a colour slice; hidden otherwise.

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
  const ring      = wrapper.querySelector('.ring');
  const tooltip   = wrapper.querySelector('.tooltip');

  /* 3‑A  ─ build the conic‑gradient string */
  const step = 100 / emotions.length;
  let acc = 0;
  const segments = emotions.map(e=>{
      const start = acc.toFixed(4);
      acc += step;
      const end   = acc.toFixed(4);
      return `${e.color} ${start}% ${end}%`;  // "orange 0% 33.333%"
  }).join(', ');
  ring.style.setProperty('--gradient',`conic-gradient(${segments})`);

  /* 3‑B  ─ pointer tracking for tooltips */
  wrapper.addEventListener('pointermove', e=>{
    const {left,top,width,height} = wrapper.getBoundingClientRect();
    const cx = left + width/2,  cy = top + height/2;
    const dx = e.clientX - cx,  dy = e.clientY - cy;
    const angle = (Math.atan2(dy,dx)*180/Math.PI + 360 + 90) % 360; // 0° at top
    const index = Math.floor(angle / (360/emotions.length));
    const emo   = emotions[index];

    tooltip.textContent = emo.name;
    tooltip.style.setProperty('--tip-hue', emo.color);
    positionTooltip(tooltip, e.clientX, e.clientY - 12);
    tooltip.removeAttribute('aria-hidden');
  });
  wrapper.addEventListener('pointerleave', ()=>tooltip.setAttribute('aria-hidden','true'));
}

function positionTooltip(el,x,y){
  el.style.left = x +'px';
  el.style.top  = y +'px';
}

Key idea: map cursor angle → segment index to reveal the correct emotion label.

⸻

4. Tooltip styling

.tooltip{
  position:fixed;          /* lives above everything */
  padding:.35em .75em;
  font:600 14px/1.2 "Inter",sans-serif;
  color:#fff;
  background:#141414;
  border-radius:8px;
  box-shadow:0 4px 16px rgba(0,0,0,.3);
  transform:translate(-50%,-100%);  /* center above pointer */
  white-space:nowrap;
  pointer-events:none;
  opacity:0;
  transition:opacity .15s ease, transform .15s ease;
}
.tooltip::after{          /* speech‑bubble tail */
  content:'';
  position:absolute;
  left:50%; bottom:-5px;
  width:10px; height:10px;
  background:inherit;
  transform:translateX(-50%) rotate(45deg);
}
.tooltip[aria-hidden="true"]{
  opacity:0; transform:translate(-50%,-90%);
}
.tooltip:not([aria-hidden]){
  opacity:1; transform:translate(-50%,-110%);
}

⸻

5. Accessibility & performance notes
	•	Reduced‑motion: Respect prefers-reduced-motion; pause the spin if requested.
	•	Keyboard focus: Add focus‑ring support by turning each segment into an ARIA‑labelled <button> if full accessibility is needed.
	•	Colour contrast: Allow a darker inner‑shadow (box-shadow: inset 0 0 0 2px #0003) to keep avatars legible against bright halos.
	•	Batch rendering: Generate gradients server‑side for static exports (SVG) to lighten client CPU on long lists.
	• Responsive sizing: Adjust `--ring-thickness` and `--ring-outer-glow` values based on avatar size for consistent visual appearance across different dimensions.

⸻

Behaviour matrix

# emotions	Gradient formula	Segment size	Tooltip logic
1	radial-gradient(…) (solid)	100 %	Always that emotion
2	linear-gradient(to right, …)	50 % left / right	Compare angle < 180°
≥3	conic-gradient(…) (see above)	360 ° / n	Angle‑to‑index map

⸻

Result

You now have a halo that perfectly echoes the soft, radiant spectrum in the reference asset, yet gracefully scales to any count of emotions. The updated implementation provides a more visually appealing radial gradient effect, with colors smoothly fading at both inner and outer edges. Each slice whispers its feeling through a sleek, dark tooltip whenever a user's cursor lingers, ensuring both beauty and clarity in the Shadow Me experience. 