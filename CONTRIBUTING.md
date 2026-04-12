# Contributing to Mobile Terminal

Thank you for your interest in contributing to Mobile Terminal! This guide will help you get started.

## Ways to Contribute

- 🐛 **Bug reports** - Help us identify issues
- 💡 **Feature requests** - Suggest new functionality
- 📝 **Documentation** - Improve guides and docs
- 💻 **Code contributions** - Add features or fix bugs
- 🎨 **Theme contributions** - Create new terminal themes
- 🧪 **Testing** - Test on different devices and browsers

## Quick Start

1. Fork the repository
2. Clone your fork: `git clone https://github.com/YOUR_USERNAME/mobile-terminal.git`
3. Install dependencies: `npm install`
4. Start development: `npm run dev`
5. Create a feature branch: `git checkout -b feature/my-feature`

## Development Setup

### Prerequisites

- Node.js 18+
- npm 9+
- Build tools (see [DEVELOPMENT.md](docs/DEVELOPMENT.md))

### Running the Project

```bash
# Install dependencies
npm install

# Start development (both frontend and backend)
npm run dev

# Or run separately
npm run server  # Backend on port 3000
npm run client  # Frontend on port 5173
```

### Testing Your Changes

1. Test on desktop browser (Chrome, Firefox, Safari)
2. Test on mobile device (use tunnel or local network)
3. Test Electron desktop app: `npm run electron`
4. Test PWA installation

## Pull Request Guidelines

1. **Create a feature branch** from `main`
2. **Test your changes** on both desktop and mobile
3. **Keep PRs focused** - one feature or fix per PR
4. **Write clear commit messages**
5. **Describe your changes** in the PR description

### PR Template

```markdown
## Description
Briefly describe what this PR does.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Refactoring

## Testing
- [ ] Tested on desktop browser
- [ ] Tested on mobile device
- [ ] Tested Electron app (if applicable)

## Screenshots (if applicable)
Add screenshots of your changes.
```

## Good First Issues

Looking for a way to contribute? Try these:

- [Add dark theme option](https://github.com/unn-Known1/mobile-terminal/labels/good%20first%20issue)
- [Document custom key bindings](https://github.com/unn-Known1/mobile-terminal/labels/enhancement)
- [Improve error messages](https://github.com/unn-Known1/mobile-terminal/labels/good%20first%20issue)
- [Add more terminal themes](https://github.com/unn-Known1/mobile-terminal/labels/enhancement)

Label filter: [`good first issue`](https://github.com/unn-Known1/mobile-terminal/labels/good%20first%20issue)

## Code Style

- Use functional React components with hooks
- Follow existing naming conventions
- Add comments for complex logic
- Keep components focused and single-purpose

## Communication

- **Issues**: Use GitHub Issues for bug reports and feature requests
- **Discussions**: Use GitHub Discussions for questions and ideas

## Recognition

Contributors will be added to the README's acknowledgments section.

---

Thank you for contributing! 🎉