# README animation source

An original, locally rendered instrument-cluster animation for GitHub Markdown. No JavaScript, external fonts, trackers or remote image-generation services are used.

## Rebuild

Requires Python 3.10+ and DejaVu Sans regular/bold TrueType fonts (usually supplied by Linux's `fonts-dejavu-core` package).

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r tools/design/requirements.txt
python tools/design/render_readme_animation.py
```

For another font installation, pass `--font-dir /path/to/dejavu`. That directory must contain `DejaVuSans.ttf` and `DejaVuSans-Bold.ttf`.

Outputs:

- `docs/assets/safemeter-animated.gif`: 960 × 480, 96 source frames (identical frames merged on export), approximately 12 seconds, shared palette, seamless colour treatment and infinite loop.
- `docs/assets/safemeter-static.png`: motion-free first frame, linked beside the animation in the README.

The generator uses supersampling for readable text, a shared palette to reduce shimmer and GIF frame optimisation to keep download size small. The clock is illustrative and compressed; the last state means **SMS queued**, not delivered. The source and artwork use the repository's MIT license.

Keep the GIF restrained: no flashing, no fabricated telemetry claims, and no extra animated badges. GitHub does not provide author-controlled pause/play or reliable reduced-motion handling for a README GIF, so retain the still-image link.
