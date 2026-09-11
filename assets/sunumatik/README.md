# Sunumatik gallery media

## Animated preview

`science-in-motion.gif` is a 960 × 352, 60-frame, six-second loop recorded from the actual Sunumatik renderers at commit [`0fea8b842caf67483c5b0e80799803872de13e69`](https://github.com/ayberkdt/sunumatik/tree/0fea8b842caf67483c5b0e80799803872de13e69). It combines three panels:

- **Solar activity:** `presets/sun_advanced/sol-sun.mjs`, `mountSol`, export mode, advanced by 0.24 simulation seconds per frame. Solar timing is illustrative and accelerated.
- **Three-body dynamics:** `presets/three_body_states/three-body.mjs`, `mountThreeBody`, figure-eight cinema view. The renderer advances through one normalized orbital cycle in 60 frames.
- **Halo orbits:** `presets/halo_manifolds/halo-manifolds.mjs`, `mountHalo`, Earth–Moon L1 view with invariant manifolds. The timeline samples one halo period in 60 frames.

The original public `advance` and `timeline.scrub` APIs drive the frames; the source simulations are unchanged. Presentation controls and the halo side panel are hidden in the capture layout. Each frame is cropped to the gallery, then encoded with Pillow using one shared 256-color palette, dithering, a 100 ms frame duration, and infinite looping. The loop restarts the excerpt; solar activity is not a periodic physical solution.

`science-in-motion-poster.png` is the first captured frame, linked as a static alternative. The GIF contains no audio and makes no requests to external rendering services.

## Original stills

These screenshots come from Ayberk Demirkanat's [Sunumatik](https://github.com/ayberkdt/sunumatik) repository, under `docs/media/` at commit [`0fea8b842caf67483c5b0e80799803872de13e69`](https://github.com/ayberkdt/sunumatik/tree/0fea8b842caf67483c5b0e80799803872de13e69/docs/media).

The original JPEGs from the earlier profile gallery remain here as unchanged reference images. The main profile now embeds the animated preview above.

- `sun.jpg`: procedural Sun scene.
- `lab-three_body_states.jpg`: three-body dynamics laboratory.
- `lab-reentry_corridor.jpg`: atmospheric reentry laboratory.
- `lab-halo_manifolds.jpg`: halo orbit and invariant manifold laboratory.
