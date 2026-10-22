# Documentation hub

**Start with the story. Follow the engineering. Inspect the evidence.**

- **Evaluating the idea?** Read the [judge’s guide](judges-guide.md).
- **Checking maturity?** Consult the [evidence & status register](project-status.md).
- **Building a demo?** Start with the [demo runbook](demo-script.md), [wiring](../hardware/wiring.md) and [test rig](../hardware/test-rig.md).
- **Exploring implementation?** Follow the [architecture](architecture.md) into the [detector design](crash-detection.md).
- **Preparing a pilot?** Review [testing](testing-plan.md), [volunteer training](volunteer-training.md) and [security](../SECURITY.md).

## Technical library

| Document | Contents |
|----------|----------|
| [`concept-document.md`](concept-document.md) | The SEVA concept document (markdown) — problem, solution, architecture, detection design, volunteer network, impact, risks, timeline |
| [`prototype-description.md`](prototype-description.md) | What the prototype physically is, hardware blocks, wiring plan, firmware behaviour, what's real vs simulated, build order |
| [`architecture.md`](architecture.md) | System, state-machine and sequence diagrams; timing budget |
| [`crash-detection.md`](crash-detection.md) | Algorithm rationale, every tunable parameter, tilt filter maths, tuning workflow, known gaps |
| [`testing-plan.md`](testing-plan.md) | Validation tables to fill in (detection, alert delivery, cancel, volunteer pilot, robustness) |
| [`demo-script.md`](demo-script.md) | 2-minute live demo, minute by minute, with fallbacks |
| [`volunteer-training.md`](volunteer-training.md) | 15-minute first-responder module + quick card |
| [`roadmap.md`](roadmap.md) | 4-week plan and post-prototype upgrades |
| `SafeMeter_Concept_Document.pdf` | Original submission PDF |
| `SafeMeter_Prototype_Detailed_Description.pdf` | Original submission PDF |

## Source documents and visual identity

The original PDFs are preserved as submission references; they include plans and intended outcomes, not independently verified validation records. Current presentation should follow the evidence register.

[`assets/hero.svg`](assets/hero.svg) is original concept artwork, not a physical prototype photograph. [`assets/system-flow.svg`](assets/system-flow.svg) is a static system diagram. Both are repository-local SVGs with accessible descriptions, use no remote fonts, and are covered by the repository’s MIT license.

[Back to SafeMeter →](../README.md)

### Animated README header

The README uses [`safemeter-animated.gif`](assets/safemeter-animated.gif), a lightweight, repository-local animation rather than remote animation services. It visualises monitoring → checking → cancellation → SMS queuing, with compressed timings and explicit simulation labels. It does not imply SMS delivery or hardware validation.

A [still PNG](assets/safemeter-static.png) is linked directly under the animation for readers who prefer no motion. GitHub does not reliably support reduced-motion media queries in README images, so the GIF loops for all readers; the still link is the motion-free alternative.

To regenerate the artwork, see [`tools/design/README.md`](../tools/design/README.md).
