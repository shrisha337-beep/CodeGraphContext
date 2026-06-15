📝 Complete Guide: How to Submit a Pull Request for the README

This guide walks you through creating and submitting a Pull Request (PR) for the CodeGraphContext README restructuring. Follow these steps carefully.


🎯 Prerequisites

Before you start, make sure you have:


GitHub Account - Sign up at https://github.com if you don't have one
Git Installed - Check with: git --version
The Restructured README - You already have this!



📌 Step 1: Fork the Repository


Go to the CodeGraphContext repository: https://github.com/Shashankss1205/CodeGraphContext
Click the "Fork" button in the top-right corner
This creates a copy of the repository under your GitHub account


After forking, you'll see the URL changes to:

https://github.com/YOUR_USERNAME/CodeGraphContext


💻 Step 2: Clone Your Forked Repository

On your local machine, open a terminal and run:

bashgit clone https://github.com/YOUR_USERNAME/CodeGraphContext.git
cd CodeGraphContext

Replace YOUR_USERNAME with your actual GitHub username.

This downloads the entire repository to your computer.


🌿 Step 3: Create a New Branch

Never make changes directly to the main branch. Create a new branch for your changes:

bashgit checkout -b improve/readme-restructuring

Or use a clearer name if you prefer:

bashgit checkout -b docs/readme-restructure
git checkout -b gssoc/readme-improvement

Verify you're on the new branch:

bashgit branch

You should see:

* improve/readme-restructuring  (the * shows your current branch)
  main


✏️ Step 4: Replace the README File


Open the folder where you cloned the repository
Find the README.md file in the root directory
Delete the old README.md
Copy your restructured README.md file into the same location


Or, if you're comfortable with the terminal:

bash# Navigate to the repo directory
cd /path/to/CodeGraphContext

# Backup the old README (optional)
cp README.md README.md.old

# Copy your new README
cp /path/to/your/CodeGraphContext_README.md README.md


📤 Step 5: Stage and Commit Your Changes

Tell Git to track your changes:

bash# Stage the changed file
git add README.md

Verify the change is staged:

bashgit status

You should see:

On branch improve/readme-restructuring

Changes to be committed:
  modified:   README.md

Now, commit your changes with a clear message:

bashgit commit -m "docs: restructure README for improved clarity and navigation"

Good commit messages:


docs: restructure README for better organization
docs: improve README structure and readability
docs: reorganize README sections for beginners


Bad commit messages:


fix
updated readme
changes



🚀 Step 6: Push Your Changes to GitHub

Upload your changes to your forked repository:

bashgit push origin improve/readme-restructuring

This pushes the branch improve/readme-restructuring to your GitHub account.

First time pushing? Git might ask for your GitHub credentials. Authenticate when prompted.


🔄 Step 7: Create a Pull Request


Go to your forked repository on GitHub:


   https://github.com/YOUR_USERNAME/CodeGraphContext


You should see a banner that says:

"improve/readme-restructuring had recent pushes"

Compare & pull request




Click the "Compare & pull request" button
If you don't see it:

Click the "Branches" tab
Find your branch improve/readme-restructuring
Click "New pull request" next to it






📋 Step 8: Fill Out the PR Details

You'll see a form. Fill it out carefully:

PR Title

docs: restructure README for improved clarity and navigation

PR Description

Use this template:

markdown## Problem Statement
The current README lacks clear structure and organization, making it difficult for new users and contributors to navigate.

## Changes
This PR restructures the CodeGraphContext README to follow standard open-source documentation practices:

- ✅ Organized into logical sections with clear hierarchy
- ✅ Removed redundant and scattered content
- ✅ Improved heading structure for better navigation
- ✅ Enhanced readability with consistent formatting
- ✅ Made content more beginner-friendly

## Key Improvements
- Sections now flow: Overview → Features → Tech Stack → Installation → Usage → Contributing → License
- Eliminated 3 duplicate "how to run" sections
- Moved maintainer info to professional footer
- Created tables for languages and database options instead of prose
- Added consistent code block formatting

## Type of Change
- [ ] Bug fix
- [x] Documentation improvement
- [ ] New feature
- [ ] Breaking change

## No functional changes - documentation only reorganization.

## Related Issues
Fixes #[issue-number] (if there was a specific issue, include it)

---

GSSoC 2026 Contribution


🔍 Step 9: Submit the PR


Scroll down to the green "Create pull request" button
Click it
Your PR is now submitted!


Congratulations! 🎉


📬 Step 10: Send the Message to the Owner

Now that your PR is created:


Go to your PR page (it shows up in your notifications)
You'll see the PR number (e.g., #123)
Copy the PR URL:


   https://github.com/Shashankss1205/CodeGraphContext/pull/[PR_NUMBER]


Send one of the messages (from earlier) to Shashank via:

GitHub PR Comments: Click on the PR, scroll down, add a comment
GitHub Issues: Create a comment linking to the PR
Direct Contact: Email or LinkedIn (if you have it)






🔄 Step 11: Review and Iteration (If Needed)

The maintainer might request changes. Here's how to handle that:

If Changes Are Requested:


Make the changes locally in your README.md
Stage, commit, and push again:


bash   git add README.md
   git commit -m "docs: update README based on feedback"
   git push origin improve/readme-restructuring


The PR automatically updates with your new changes—no need to create a new PR!
Add a comment on the PR explaining what you changed



✅ Checklist Before Submitting


 README.md file is replaced with the restructured version
 You're on a new branch (not main)
 Changes are committed with a clear message
 Changes are pushed to your fork
 PR title clearly describes the change
 PR description explains the problem and solution
 PR has no conflicts with the main branch
 You've linked the issue (if applicable)



🚨 Troubleshooting

"I see a merge conflict"

This means the original README changed since you forked. Don't panic—contact the maintainer or ask for help in the GSSoC community.

"The git command is not found"

Install Git from https://git-scm.com/

"My push was rejected"

Make sure:


You're on the correct branch: git branch
You committed your changes: git status
The branch name matches what you pushed


"I can't find the 'Compare & pull request' button"


Go to the original repo: https://github.com/Shashankss1205/CodeGraphContext
Click "Pull requests" tab
Click "New pull request"
Select your fork and branch



📚 Helpful Resources


Git Basics: https://git-scm.com/book/en/v2
GitHub PR Guide: https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/about-pull-requests
How to Write Good Commit Messages: https://chris.beams.io/posts/git-commit/
