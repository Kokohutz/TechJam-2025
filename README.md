# 2025 TechJam Hackathon

## Getting Started

### Prerequisites

- Git installed on your machine
- [Node.js](https://nodejs.org/)
- [Your package manager] (npm/yarn/pnpm)
- **Git LFS (Large File Storage)** - Required for handling model files

### Git LFS Setup

This project uses Git LFS to handle large model files efficiently. You'll need to set this up before cloning.

#### Install Git LFS

**On macOS:**
```bash
brew install git-lfs
```

**On Ubuntu/Debian:**
```bash
sudo apt install git-lfs
```

**On Windows:**
Download from [git-lfs.github.io](https://git-lfs.github.io/) or use:
```bash
winget install Git.Git-LFS
```

**On other systems:**
Visit [git-lfs.github.io](https://git-lfs.github.io/) for installation instructions.

#### Initialize Git LFS

After installation, initialize Git LFS:
```bash
git lfs install
```

### Clone the Repository

1. **Clone the project to your local machine:**
   
   ```bash
   git clone https://github.com/Kokohutz/TechJam-2025.git
   cd TechJam-2025
   ```

   > **Note:** The clone will automatically download LFS files. This may take longer than usual due to model files.

2. **Verify LFS files were downloaded:**
   
   ```bash
   git lfs ls-files
   ```

3. **Install dependencies:**
   
   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

4. **Set up environment variables:**
   
   ```bash
   cp .env.example .env
   # Edit .env file with your local configuration
   ```

5. **Start the development server:**
   
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

## Working with Model Files

### Tracked File Types

The following file types are automatically tracked by Git LFS:
- `.pkl` - Pickle files
- `.h5` - HDF5 model files  
- `.pb` - TensorFlow protobuf files
- `.onnx` - ONNX model files
- `.bin` - Binary model files
- `.safetensors` - SafeTensors files
- `.pt` - PyTorch files
- `.pth` - PyTorch checkpoint files
- `.joblib` - Joblib files

### Adding New Model Files

When adding new model files to the project:

1. **Ensure the file type is tracked by LFS:**
   ```bash
   git lfs track "*.your-extension"
   git add .gitattributes
   git commit -m "Track new model file type with LFS"
   ```

2. **Add and commit your model file:**
   ```bash
   git add path/to/your/model.pkl
   git commit -m "Add new model file"
   ```

3. **Push to remote (this will upload to LFS):**
   ```bash
   git push origin your-branch
   ```

### LFS Storage Limits

- GitHub LFS: 1GB free, then paid storage
- GitLab LFS: 10GB free per repository
- Keep model files optimized and remove unused models

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

2. **Create a new branch for your feature/task:**
   
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

2. **Keep your branch updated with main:**
   
   ```bash
   git checkout main
   git pull origin main
   git checkout feature/your-name/your-feature
   git merge main
   # Resolve any conflicts if they arise
   ```

3. **Push your branch to remote:**
   
   ```bash
   git push origin feature/your-name/your-feature
   ```

#### Creating a Pull Request

1. **Push your completed feature branch**
2. **Go to GitHub/GitLab and create a Pull Request**
3. **Fill out the PR template with:**
   - Description of changes
   - Testing instructions
   - Screenshots (if UI changes)
   - Any breaking changes
   - Model file changes (if applicable)
4. **Request review from team members**
5. **Address any feedback and push updates**

#### After Your PR is Merged

1. **Delete your local branch:**
   
   ```bash
   git checkout main
   git pull origin main
   git branch -d feature/your-name/your-feature
   ```

2. **Delete remote branch (optional, usually done automatically):**
   
   ```bash
   git push origin --delete feature/your-name/your-feature
   ```

## Development Guidelines

### Code Quality

- Follow the project's coding standards
- Write meaningful commit messages
- Include tests for new features
- Update documentation as needed
- Optimize model files before committing

### Commit Message Format

```
type: brief description

Detailed explanation if needed

- List any breaking changes
- Reference issue numbers (#123)
- Note any model file changes
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `model`

### Before Pushing

- [ ] Run tests: `npm test`
- [ ] Check linting: `npm run lint`
- [ ] Build successfully: `npm run build`
- [ ] Update documentation if needed
- [ ] Verify LFS files are tracked: `git lfs ls-files`
- [ ] Check model file sizes are reasonable

## Deployment

### Main Branch Deployment

- The `main` branch automatically deploys to production
- Only merge to main after thorough testing
- Use pull requests for all changes to main
- Maintainers will handle the merge and deployment
- LFS files are automatically deployed with the application

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

**LFS Issues:**

**File not downloading properly:**
```bash
git lfs pull
```

**Check LFS status:**
```bash
git lfs status
```

**Re-download all LFS files:**
```bash
git lfs fetch --all
git lfs checkout
```

**Large file committed without LFS:**
```bash
# Track the file type with LFS
git lfs track "*.pkl"
git add .gitattributes

# Remove from Git history and re-add with LFS
git rm --cached large-file.pkl
git add large-file.pkl
git commit -m "Track large file with LFS"
```

## Getting Help

- Check existing issues on GitHub/GitLab
- Ask questions in the team chat
- Review the project documentation
- Contact the maintainers: [maintainer-emails]
- For LFS issues: [Git LFS documentation](https://git-lfs.github.io/)

## Contributing

1. Fork the repository
2. Set up Git LFS on your machine
3. Create your feature branch
4. Make your changes
5. Add tests and documentation
6. Ensure model files are properly tracked with LFS
7. Submit a pull request

Thank you for contributing to our project! 🚀

## Additional Resources

- [Git LFS Tutorial](https://github.com/git-lfs/git-lfs/wiki/Tutorial)
- [Working with Large Files](https://docs.github.com/en/repositories/working-with-files/managing-large-files)
- [Best Practices for ML Projects](https://dvc.org/doc/user-guide/how-to/contribute-model)