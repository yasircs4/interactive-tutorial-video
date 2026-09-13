# Contributing to Interactive Tutorial Video

Contributions are welcome from developers, automation engineers, and designers.

## Guidelines

1. Follow the [Agent Skills Specification](https://agentskills.io/specification).
2. Maintain clean, well-documented scripts without external bloat.
3. Test all Playwright and overlay animations across standard viewports (1080p minimum).
4. Preserve cross-platform script paths where possible (with macOS-specific helpers clearly identified).
5. Do not introduce em dashes into code comments, markdown documentation, or commit messages.

## Development Setup

```bash
git clone https://github.com/yasircs4/interactive-tutorial-video.git
cd interactive-tutorial-video
pnpm install
```

## Submitting Pull Requests

1. Fork the repository.
2. Create your feature branch (`git checkout -b feature/amazing-feature`).
3. Commit your changes (`git commit -m 'feat: add amazing feature'`).
4. Push to the branch (`git push origin feature/amazing-feature`).
5. Open a Pull Request.
