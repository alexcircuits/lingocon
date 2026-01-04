# Private Git Deployment (No GitHub)

This guide shows you how to use your VPS as your own private Git server. You will be able to "push" code from your laptop directly to your VPS, and it will update automatically.

## Part 1: Local Setup (On your Laptop)

1. **Initialize Git**:
   If you haven't already, open your terminal in the `langua` folder and run:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Create a `.gitignore`**:
   Ensure you don't push huge folders like `node_modules` or sensitive `.env` files.
   ```bash
   # Create file if it doesn't exist
   nano .gitignore
   ```
   Add these lines:
   ```text
   node_modules/
   .next/
   .env
   .env.local
   dist/
   ```

---

## Part 2: Server Setup (On your VPS)

1. **Create a Bare Repository**:
   A "bare" repository is a Git folder without a working directory (it just stores the history). We put this in a separate folder from your web files.
   ```bash
   # Connect to VPS
   ssh root@YOUR_VPS_IP

   # Create the git folder
   mkdir -p /var/git/lingocon.git
   cd /var/git/lingocon.git
   git init --bare
   ```

2. **Setup the Auto-Deploy Hook**:
   We want the VPS to automatically copy the code to `/var/www/lingocon` and run your deployment script whenever you push.
   ```bash
   nano hooks/post-receive
   ```
   Paste this script:
   ```bash
   #!/bin/bash
   # Define target directory and git directory
   TARGET="/var/www/lingocon"
   GIT_DIR="/var/git/lingocon.git"

   # 1. Checkout the latest code to the web folder
   echo "🚀 Deploying to $TARGET..."
   git --work-tree=$TARGET --git-dir=$GIT_DIR checkout -f main

   # 2. Run your deployment script
   cd $TARGET
   chmod +x deploy.sh
   ./deploy.sh
   ```
   **Make it executable**:
   ```bash
   chmod +x hooks/post-receive
   ```

---

## Part 3: Connect Laptop to VPS

On your **Laptop**, tell Git that your VPS is the "destination" (remote):

```bash
git remote add vps root@YOUR_VPS_IP:/var/git/lingocon.git
```

---

## Part 4: The Update Workflow

From now on, this is how you update your website:

1. **Make changes** to your code on your laptop.
2. **Commit** them:
   ```bash
   git add .
   git commit -m "Fixed the login button"
   ```
3. **Push to VPS**:
   ```bash
   git push vps main
   ```

### Why is this better?
- **Fast**: Only the changes (diffs) are sent over SSH.
- **Versions**: You can see your history with `git log`.
- **Revert**: If you break something, you can go back to a previous version in seconds.
- **Private**: No third-party (like GitHub) sees your code.
- **Automated**: The moment you finish the `push`, your site is already building and updating itself.
