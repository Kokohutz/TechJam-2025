<<<<<<< HEAD
## Rspeedy project

This is a ReactLynx project bootstrapped with `create-rspeedy`.

## Getting Started

First, install the dependencies:

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Scan the QRCode in the terminal with your LynxExplorer App to see the result.

You can start editing the page by modifying `src/App.tsx`. The page auto-updates as you edit the file.
=======
# 2025 TechJam Hackathon

## Getting Started

### Prerequisites

- Git installed on your machine
- [Node.js](https://nodejs.org/) (version X.X or higher)
- [Your package manager] (npm/yarn/pnpm)
- [Any other dependencies specific to your project]

### Clone the Repository

1. **Clone the project to your local machine:**
   
   ```bash
   git clone https://github.com/Kokohutz/app-mbc_minions.git
   cd app-mbc_minions
   ```
1. **Install dependencies:**
   
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```
1. **Set up environment variables:**
   
   ```bash
   cp .env.example .env
   # Edit .env file with your local configuration
   ```
1. **Start the development server:**
   
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

## Branch Strategy

### Main Branch

- **`main`** - Production-ready code that gets deployed
- Only maintainers can merge to main
- All code in main should be tested and reviewed
- Automatic deployment triggers from main branch

### Development Workflow

#### Creating Your Feature Branch

1. **Always start from the latest main branch:**
   
   ```bash
   git checkout main
   git pull origin main
   ```
1. **Create a new branch for your feature/task:**
   
   ```bash
   # Use a descriptive branch name
   git checkout -b feature/your-name/brief-description
   
   # Examples:
   git checkout -b feature/john/user-authentication
   git checkout -b feature/sarah/shopping-cart-ui
   git checkout -b bugfix/mike/login-error-handling
   ```

#### Branch Naming Convention

Use the following format: `type/your-name/description`

**Types:**

- `feature/` - New features or enhancements
- `bugfix/` - Bug fixes
- `hotfix/` - Critical fixes that need immediate deployment
- `refactor/` - Code refactoring without functionality changes
- `docs/` - Documentation updates

**Examples:**

```bash
feature/alex/payment-integration
bugfix/maria/responsive-mobile-menu
hotfix/david/security-vulnerability
refactor/sam/database-optimization
docs/lisa/api-documentation
```

#### Working on Your Branch

1. **Make your changes and commit regularly:**
   
   ```bash
   git add .
   git commit -m "Add user registration form validation"
   ```
1. **Keep your branch updated with main:**
   
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-name/your-feature
   git merge main
   # Resolve any conflicts if they arise
   ```
1. **Push your branch to remote:**
   
   ```bash
   git push origin feature/your-name/your-feature
   ```

#### Creating a Pull Request

1. **Push your completed feature branch**
1. **Go to GitHub/GitLab and create a Pull Request**
1. **Fill out the PR template with:**
- Description of changes
- Testing instructions
- Screenshots (if UI changes)
- Any breaking changes
1. **Request review from team members**
1. **Address any feedback and push updates**

#### After Your PR is Merged

1. **Delete your local branch:**
   
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/your-name/your-feature
   ```
1. **Delete remote branch (optional, usually done automatically):**
   
   ```bash
   git push origin --delete feature/your-name/your-feature
   ```

## Development Guidelines

### Code Quality

- Follow the project’s coding standards
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed

### Commit Message Format

```
type: brief description

Detailed explanation if needed

- List any breaking changes
- Reference issue numbers (#123)
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Before Pushing

- [ ] Run tests: `npm test`
- [ ] Check linting: `npm run lint`
- [ ] Build successfully: `npm run build`
- [ ] Update documentation if needed

## Deployment

### Main Branch Deployment

- The `main` branch automatically deploys to production
- Only merge to main after thorough testing
- Use pull requests for all changes to main
- Maintainers will handle the merge and deployment

### Environment URLs

- **Development:** http://localhost:3000
- **Staging:** https://staging.yourproject.com
- **Production:** https://yourproject.com

## Troubleshooting

### Common Issues

**Merge Conflicts:**

```bash
git checkout main
git pull origin main
git checkout your-branch
git merge main
# Resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts"
```

**Accidentally Committed to Main:**

```bash
# Move your changes to a new branch
git branch feature/your-name/accidental-changes
git reset --hard HEAD~1  # Remove the commit from main
git checkout feature/your-name/accidental-changes
```

**Need to Update Branch Name:**

```bash
git branch -m old-branch-name new-branch-name
git push origin -u new-branch-name
git push origin --delete old-branch-name
```

## Getting Help

- Check existing issues on GitHub/GitLab
- Ask questions in the team chat
- Review the project documentation
- Contact the maintainers: [maintainer-emails]

## Contributing

1. Fork the repository
1. Create your feature branch
1. Make your changes
1. Add tests and documentation
1. Submit a pull request

Thank you for contributing to our project! 🚀
>>>>>>> 1a4483e4dff10c7f566dbbb84fa7f4691938b80e
