# Complete Production Deployment Guide - From Scratch

> **For Complete Beginners** - This guide assumes you have NEVER done any of this before. We explain every single click.
> 
> **🍎 Mac M1/M2/M3 Users**: This guide includes specific instructions for Apple Silicon Macs throughout. Look for the 🍎 icon!
> 
> **🪟 Windows Users**: This guide includes specific instructions for Windows throughout. Look for the 🪟 icon!

---

## 🚀 QUICK START: Which Path Should YOU Take?

**Answer these 3 questions to find YOUR path:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    🤔 QUICK START DECISION TREE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Question 1: Do you just want to TEST the app on your computer first?       │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ YES → Go to Section: "RUN LOCALLY FIRST" (Page 2)                   │    │
│  │       Time needed: 30 minutes                                        │    │
│  │       Cost: FREE                                                     │    │
│  │       What you need: Just your laptop                               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Question 2: Do you want to deploy online but keep things SIMPLE?           │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ YES → Go to Section: "MY FIRST DEPLOYMENT" (Recommended!)           │    │
│  │       Time needed: 1-2 hours                                         │    │
│  │       Cost: $0-25/month                                              │    │
│  │       What you need: Supabase account + Vercel/Netlify account      │    │
│  │       ⭐ BEST FOR: Most users, small businesses, startups           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  Question 3: Do you need COMPLETE control over everything?                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ YES → Go to Section: "FULL INDEPENDENCE" (Advanced)                 │    │
│  │       Time needed: 1-4 weeks                                         │    │
│  │       Cost: $40-200/month                                            │    │
│  │       What you need: DevOps knowledge, server management            │    │
│  │       ⚠️ ONLY FOR: Large enterprises, specific compliance needs     │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 📊 Visual Decision Flowchart

```
                            START HERE
                                │
                                ▼
                    ┌───────────────────────┐
                    │ Have you ever run a   │
                    │ web app on your       │
                    │ computer before?      │
                    └───────────────────────┘
                          │           │
                         NO          YES
                          │           │
                          ▼           ▼
            ┌─────────────────┐  ┌─────────────────┐
            │ START WITH:     │  │ Do you need it  │
            │ "Run Locally    │  │ live on the     │
            │ First" section  │  │ internet?       │
            │                 │  └─────────────────┘
            │ This teaches    │        │       │
            │ you the basics! │       NO      YES
            └─────────────────┘        │       │
                                       ▼       ▼
                         ┌─────────────────┐  ┌─────────────────┐
                         │ Just run        │  │ Do you need     │
                         │ locally for     │  │ 100% control    │
                         │ testing/demo    │  │ over servers?   │
                         └─────────────────┘  └─────────────────┘
                                                    │       │
                                                   NO      YES
                                                    │       │
                                                    ▼       ▼
                                    ┌─────────────────┐  ┌─────────────────┐
                                    │ "MY FIRST       │  │ "FULL           │
                                    │ DEPLOYMENT"     │  │ INDEPENDENCE"   │
                                    │                 │  │                 │
                                    │ ⭐ Recommended! │  │ ⚠️ Advanced     │
                                    │ Simple & Fast   │  │ Complex setup   │
                                    └─────────────────┘  └─────────────────┘
```

### 🎯 Quick Comparison Table

| I want to... | Go to section | Time | Cost | Difficulty |
|-------------|---------------|------|------|------------|
| Just test it on my laptop | "Run Locally First" | 30 min | FREE | ⭐ Easy |
| Deploy online (simple) | "My First Deployment" | 1-2 hours | $0-25/mo | ⭐⭐ Medium |
| Full control/enterprise | "Full Independence" | 1-4 weeks | $40-200/mo | ⭐⭐⭐⭐⭐ Expert |

---

## 📋 Table of Contents

### Part 0: Getting Started (DO THIS FIRST!)
- [Quick Start Decision Tree](#-quick-start-which-path-should-you-take) ← **YOU ARE HERE**
- [Run Locally First](#-run-locally-first-before-any-deployment) ← **START HERE**

### Part 1: The Basics
1. [Overview](#1-overview)
2. [What You'll Need (Prerequisites)](#2-what-youll-need-prerequisites)
3. [🍎 Mac M1/M2/M3 Specific Setup](#3--mac-m1m2m3-specific-setup)
4. [🪟 Windows Specific Setup](#4--windows-specific-setup) ← **NEW!**

### Part 2: Create Your Accounts
5. [Create Your Supabase Account](#5-create-your-supabase-account)
6. [Create Your AWS Account](#6-create-your-aws-account)
7. [Get Your OpenAI API Key](#7-get-your-openai-api-key)
8. [Set Up Your Domain (Optional)](#8-set-up-your-domain-optional)

### Part 3: My First Deployment (RECOMMENDED PATH)
9. [Install Required Tools](#9-install-required-tools)
10. [Clone and Configure the Project](#10-clone-and-configure-the-project)
11. [Set Up Supabase Database](#11-set-up-supabase-database)
12. [Deploy to Vercel (Easiest)](#12-deploy-to-vercel-easiest)
13. [Verification Checklist](#13-verification-checklist) ← **NEW!**

### Part 4: Alternative Deployments
14. [Deploy to AWS](#14-deploy-to-aws)
15. [Troubleshooting](#15-troubleshooting)
16. [Cost Estimates](#16-cost-estimates)

### Part 5: Full Independence (Advanced)
17. [Understanding Your Options](#17-understanding-your-deployment-options)
18. [Option A: Your Own Supabase](#18-option-a-deploy-to-your-own-supabase-account)
19. [Option B: Convert to Node.js](#19-option-b-convert-edge-functions-to-nodejs)
20. [Option C: Self-Hosted Supabase](#20-option-c-self-hosted-supabase-docker)

---

## 🖥️ RUN LOCALLY FIRST (Before Any Deployment)

> **⏱️ Time needed: 30 minutes**
> **💰 Cost: FREE**
> **🎯 Goal: See the app running on YOUR computer**

This is the BEST way to start! Before deploying anywhere, let's make sure everything works on your computer.

### Step L1: Do You Have a Computer Ready?

**What you need:**
- ✅ A laptop or desktop computer (Mac or Windows)
- ✅ At least 4GB of free disk space
- ✅ Internet connection
- ✅ About 30 minutes of time

**What you DON'T need yet:**
- ❌ Credit card
- ❌ Any accounts
- ❌ Technical knowledge

### Step L2: Open Your "Command Center" (Terminal/Command Prompt)

Your computer has a special window where you type commands. Here's how to open it:

#### 🍎 On Mac:

**Method 1: Spotlight (Fastest)**
1. Press **Cmd (⌘) + Space** on your keyboard
2. A search box appears in the center of your screen
3. Type: `Terminal`
4. Press **Enter**

**Method 2: Finder**
1. Click the 😊 smiley face icon (Finder) in your Dock
2. Click **Go** in the menu bar at the top
3. Click **Utilities**
4. Double-click **Terminal**

**What you should see:**
```
┌─────────────────────────────────────────────────────────────┐
│ Terminal                                                     │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Last login: Fri Dec 27 10:00:00 on ttys000                  │
│ yourname@Your-MacBook ~ %                                    │
│                                                              │
│ █                                                            │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

The blinking cursor (█) means it's ready for your commands!

#### 🪟 On Windows:

**Method 1: Search (Fastest)**
1. Press the **Windows key** on your keyboard (the key with ⊞ symbol)
2. Type: `cmd`
3. You'll see "Command Prompt" appear
4. Click on it OR press **Enter**

**Method 2: Run Dialog**
1. Press **Windows + R** together
2. A small "Run" window appears
3. Type: `cmd`
4. Click **OK** or press **Enter**

**Method 3: PowerShell (More Modern)**
1. Press the **Windows key**
2. Type: `PowerShell`
3. Click on **Windows PowerShell**

**What you should see:**
```
┌─────────────────────────────────────────────────────────────┐
│ Command Prompt                                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Microsoft Windows [Version 10.0.22631.4460]                 │
│ (c) Microsoft Corporation. All rights reserved.              │
│                                                              │
│ C:\Users\YourName>█                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step L3: Check If You Already Have the Tools

Let's check if you already have what we need installed. Type these commands one at a time:

#### 🍎 On Mac:

```bash
# Check for Node.js
node --version
```

**If you see:** `v20.10.0` (or any number starting with v) → ✅ You have Node.js!
**If you see:** `command not found` → ❌ Need to install (go to Step L4)

```bash
# Check for Git  
git --version
```

**If you see:** `git version 2.x.x` → ✅ You have Git!
**If you see:** `command not found` → ❌ Need to install (go to Step L4)

#### 🪟 On Windows:

```cmd
:: Check for Node.js
node --version
```

**If you see:** `v20.10.0` (or any number starting with v) → ✅ You have Node.js!
**If you see:** `'node' is not recognized` → ❌ Need to install (go to Step L4)

```cmd
:: Check for Git
git --version
```

**If you see:** `git version 2.x.x` → ✅ You have Git!
**If you see:** `'git' is not recognized` → ❌ Need to install (go to Step L4)

### Step L4: Install Missing Tools

#### 🍎 Mac - Install Node.js:

**Option A: Download from Website (Easiest for Beginners)**
1. Open your web browser (Safari, Chrome, etc.)
2. Go to: `https://nodejs.org`
3. Click the green button that says **"LTS"** (the one on the LEFT)
4. A file downloads (something like `node-v20.x.x.pkg`)
5. Find the file in your Downloads folder
6. Double-click it
7. Click **Continue** through all the screens
8. Click **Install**
9. Enter your Mac password if asked
10. Click **Close** when done

**Option B: Using Homebrew (Better for Developers)**
```bash
# First, install Homebrew (Mac's app installer)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Follow the on-screen instructions!
# Then install Node.js:
brew install node
```

#### 🪟 Windows - Install Node.js:

**Step-by-Step with Screenshots Description:**

1. **Open your browser** and go to: `https://nodejs.org`
   
2. **Click the LTS button** (green button on the left)
   ```
   ┌─────────────────────────────────────────────┐
   │  nodejs.org                                  │
   ├─────────────────────────────────────────────┤
   │                                              │
   │  Node.js®                                    │
   │                                              │
   │  ┌─────────────┐    ┌─────────────┐         │
   │  │   20.x LTS  │    │   21.x      │         │
   │  │  Recommended│    │   Current   │         │
   │  │  [CLICK ME] │    │             │         │
   │  └─────────────┘    └─────────────┘         │
   │                                              │
   └─────────────────────────────────────────────┘
   ```

3. **Wait for download** - Look at the bottom of your browser for the download progress

4. **Find the downloaded file:**
   - Press **Windows + E** to open File Explorer
   - Click **Downloads** in the left sidebar
   - Look for a file like `node-v20.x.x-x64.msi`

5. **Double-click the file to run it**

6. **If Windows asks "Do you want to allow this app...":**
   - Click **Yes**

7. **Node.js Setup Wizard appears:**
   ```
   ┌─────────────────────────────────────────────┐
   │  Node.js Setup                               │
   ├─────────────────────────────────────────────┤
   │                                              │
   │  Welcome to the Node.js Setup Wizard        │
   │                                              │
   │  The Setup Wizard will install Node.js      │
   │  on your computer.                          │
   │                                              │
   │              [Next >]   [Cancel]            │
   │                                              │
   └─────────────────────────────────────────────┘
   ```
   Click **Next**

8. **License Agreement:**
   - Check the box ☑️ "I accept the terms..."
   - Click **Next**

9. **Destination Folder:**
   - Leave as default (C:\Program Files\nodejs\)
   - Click **Next**

10. **Custom Setup:**
    - Leave everything checked
    - Click **Next**

11. **Tools for Native Modules:**
    - ☑️ Check "Automatically install necessary tools"
    - Click **Next**

12. **Click "Install"**
    - If Windows asks permission again, click **Yes**
    - Wait for installation (1-3 minutes)

13. **Click "Finish"**

14. **IMPORTANT: Close ALL Command Prompt windows and open a NEW one**
    - Press **Windows + R**
    - Type `cmd`
    - Press **Enter**

15. **Verify installation:**
    ```cmd
    node --version
    ```
    You should see: `v20.x.x` ✅

#### 🪟 Windows - Install Git:

1. **Go to:** `https://git-scm.com/download/win`

2. **The download starts automatically** - Look for `Git-2.x.x-64-bit.exe`

3. **Run the downloaded file**

4. **Git Setup Wizard:**
   - Click **Next** on the welcome screen
   - **Select Destination:** Leave as default → **Next**
   - **Select Components:** Leave as default → **Next**
   - **Start Menu Folder:** Leave as default → **Next**
   - **Default Editor:** 
     - If you have VS Code: Select "Use Visual Studio Code"
     - Otherwise: Leave as "Use Vim" → **Next**
   - **Initial Branch Name:** Select "Let Git decide" → **Next**
   - **PATH Environment:** Select middle option "Git from the command line..." → **Next**
   - **SSH:** Leave as "Use bundled OpenSSH" → **Next**
   - **HTTPS:** Leave as "Use the native Windows Secure Channel library" → **Next**
   - **Line Endings:** Leave as "Checkout Windows-style, commit Unix-style" → **Next**
   - **Terminal Emulator:** Leave as "Use MinTTY" → **Next**
   - **Default Pull:** Leave as default → **Next**
   - **Credential Helper:** Leave as default → **Next**
   - **Extra Options:** Leave defaults checked → **Next**
   - **Experimental:** Leave unchecked → **Install**

5. **Wait for installation** (1-2 minutes)

6. **Click Finish**

7. **Close and reopen Command Prompt**, then verify:
   ```cmd
   git --version
   ```
   You should see: `git version 2.x.x` ✅

### Step L5: Download the TalentGeenie Code

Now let's get the actual application code onto your computer!

#### 🍎 Mac:

```bash
# Go to your home folder
cd ~

# Create a Projects folder (if you don't have one)
mkdir -p Projects

# Go into the Projects folder
cd Projects

# Download the code (this takes 1-2 minutes)
git clone https://github.com/YOUR_USERNAME/talentgeenie.git

# Go into the project folder
cd talentgeenie
```

> **📝 Note:** Replace `YOUR_USERNAME/talentgeenie` with the actual repository URL. 
> If you exported from Lovable to GitHub, it would be something like:
> `https://github.com/yourgithubname/your-project-name.git`

#### 🪟 Windows:

```cmd
:: Go to your Documents folder
cd %USERPROFILE%\Documents

:: Create a Projects folder
mkdir Projects

:: Go into Projects folder
cd Projects

:: Download the code (this takes 1-2 minutes)
git clone https://github.com/YOUR_USERNAME/talentgeenie.git

:: Go into the project folder
cd talentgeenie
```

**What you should see:**
```
Cloning into 'talentgeenie'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
remote: Compressing objects: 100% (456/456), done.
Receiving objects: 100% (1234/1234), 5.67 MiB | 2.34 MiB/s, done.
Resolving deltas: 100% (789/789), done.
```

### Step L6: Install the App's Dependencies

The app needs other software pieces to work. Let's install them:

#### 🍎 Mac AND 🪟 Windows (Same Command!):

```bash
npm install
```

**What you should see:**
```
added 234 packages, and audited 235 packages in 45s

123 packages are looking for funding
  run `npm fund` for details

found 0 vulnerabilities
```

⏱️ This takes 1-5 minutes depending on your internet speed.

**If you see errors:**
- If it says "npm is not recognized" → Go back to Step L4 and install Node.js
- If it shows red "ERR!" messages → Try running `npm install` again

### Step L7: Set Up Environment Variables

The app needs some secret keys to connect to services. For local testing, we'll create a file with placeholder values:

#### 🍎 Mac:

```bash
# Create the environment file
cp .env.example .env

# Open it in a text editor
open -e .env
```

If that doesn't work, try:
```bash
nano .env
```

#### 🪟 Windows:

```cmd
:: Create the environment file
copy .env.example .env

:: Open it in Notepad
notepad .env
```

**Edit the file to look like this (for LOCAL TESTING ONLY):**
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

> **⚠️ Important:** For local testing without a real database, some features won't work. That's OK! 
> You're just making sure the app RUNS. We'll set up real connections later.

### Step L8: Run the App Locally!

This is the exciting part - let's see the app in action!

```bash
npm run dev
```

**What you should see:**
```
  VITE v5.0.0  ready in 234 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.100:5173/
  ➜  press h + enter to show help
```

### Step L9: Open the App in Your Browser!

1. Open your web browser (Chrome, Firefox, Safari, Edge)
2. In the address bar, type: `http://localhost:5173`
3. Press **Enter**

**🎉 You should see the TalentGeenie application!**

```
┌─────────────────────────────────────────────────────────────┐
│  🌐 http://localhost:5173                                    │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│     ╔═══════════════════════════════════════════════════╗   │
│     ║                                                    ║   │
│     ║              🎯 TalentGeenie                       ║   │
│     ║                                                    ║   │
│     ║      AI-Powered Interview Assessment Platform     ║   │
│     ║                                                    ║   │
│     ║         [Get Started]    [Learn More]              ║   │
│     ║                                                    ║   │
│     ╚═══════════════════════════════════════════════════╝   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Step L10: Stop the App

When you're done testing, go back to your Terminal/Command Prompt and:

- Press **Ctrl + C** (hold Control key and press C)
- Type `Y` if asked to confirm

**Congratulations! 🎉** You've successfully run the app on your computer!

### ✅ Local Testing Checklist

Before moving to deployment, verify:

- [ ] App opens in browser at http://localhost:5173
- [ ] Landing page displays correctly
- [ ] No red error messages in the terminal
- [ ] Navigation menu appears and clicks work

---

## Before You Start - What You Need

### Physical Requirements
- ✅ A computer (Windows, Mac, or Linux)
- ✅ **Mac M1/M2/M3 Pro/Max fully supported!**
- ✅ Stable internet connection
- ✅ A web browser (Chrome recommended)
- ✅ About 3-5 hours of uninterrupted time
- ✅ A credit/debit card (for AWS verification - you won't be charged if you stay in free tier)
- ✅ A phone number (for verification)
- ✅ An email address you can access

### What is This Guide About?
This guide will help you take TalentGeenie and run it on YOUR OWN servers, completely separate from where it was developed. Think of it like:
- Development = The test version (like a draft of a book)
- Production = The live version (like the published book)

You'll create your own accounts for everything, so you have full control.

---

## 1. Overview

### What is Supabase?
Supabase is like a "database in the cloud". Instead of running your own database server, Supabase handles it for you. It stores:
- User accounts (emails, passwords)
- Interview data
- Questions and answers
- Everything your app needs to remember

### What is AWS?
AWS (Amazon Web Services) is Amazon's cloud platform. We use it to:
- Host your website so people can access it
- Store files like recordings
- Run your application 24/7

### What is OpenAI?
OpenAI provides the AI that:
- Generates interview questions
- Evaluates candidate answers
- Analyzes proctoring videos

### Architecture (How It All Connects)
```
┌─────────────────────────────────────────────────────────────────┐
│                     YOUR PRODUCTION ENVIRONMENT                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Users     │───▶│   AWS       │───▶│   Supabase          │  │
│  │  (Browser)  │    │  (Hosting)  │    │   (Database +       │  │
│  └─────────────┘    └─────────────┘    │    Auth + Storage)  │  │
│                            │           └─────────────────────┘  │
│                            │                      │              │
│                            ▼                      ▼              │
│                     ┌─────────────┐    ┌─────────────────────┐  │
│                     │   OpenAI    │    │   Email Service     │  │
│                     │   (AI)      │    │   (SMTP)            │  │
│                     └─────────────┘    └─────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. What You'll Need (Prerequisites)

### Accounts to Create (All Free to Start)

| Service | What It Does | Starting Cost | Link |
|---------|--------------|---------------|------|
| **Supabase** | Stores your data | Free tier available | https://supabase.com |
| **AWS** | Hosts your website | Free for 12 months | https://aws.amazon.com |
| **GitHub** | Stores your code | Free | https://github.com |
| **OpenAI** | AI features | ~$5 to start | https://platform.openai.com |

---

## 3. 🍎 Mac M1/M2/M3 Specific Setup

> **This section is specifically for Mac users with Apple Silicon (M1, M2, M3, M1 Pro, M2 Pro, M3 Pro, M1 Max, M2 Max, M3 Max)**

### 3.1 Check Your Mac Type

**Step 1: Verify You Have Apple Silicon**
1. Click the **Apple logo ()** in the top-left corner of your screen
2. Click **"About This Mac"**
3. Look for "Chip" - it should say:
   - **Apple M1** or **Apple M1 Pro** or **Apple M1 Max**
   - **Apple M2** or **Apple M2 Pro** or **Apple M2 Max**
   - **Apple M3** or **Apple M3 Pro** or **Apple M3 Max**

> 💡 If it says "Intel" instead, you have an Intel Mac - the regular Mac instructions will work fine!

### 3.2 Open Terminal (Your Command Center)

Terminal is where you'll type commands. Here's how to open it:

**Method 1: Spotlight Search (Fastest)**
1. Press **Cmd (⌘) + Space** on your keyboard
2. Type: `Terminal`
3. Press **Enter** when Terminal appears

**Method 2: Finder**
1. Click **Finder** in your Dock
2. Click **Applications** in the left sidebar
3. Open **Utilities** folder
4. Double-click **Terminal**

**Method 3: Launchpad**
1. Click the **Launchpad** icon in your Dock (grid of colorful squares)
2. Type: `Terminal`
3. Click the **Terminal** app

> 💡 **Pro Tip**: Right-click Terminal in your Dock and select "Options" → "Keep in Dock" for easy access!

### 3.3 Understanding Terminal Basics

When you open Terminal, you'll see something like:
```
yourusername@Your-MacBook-Pro ~ %
```

This means:
- `yourusername` = Your Mac username
- `Your-MacBook-Pro` = Your computer's name
- `~` = You're in your home folder
- `%` = Ready for your command

**Essential Commands You'll Use:**
```bash
# See where you are
pwd

# List files in current folder
ls

# Go to a folder
cd foldername

# Go to Documents folder
cd ~/Documents

# Go back one folder
cd ..

# Go to home folder
cd ~

# Clear the screen
clear
```

### 3.4 Install Xcode Command Line Tools (REQUIRED FIRST!)

This is the FIRST thing every Mac user must do. It installs basic developer tools.

**Step 1: Open Terminal**
1. Press **Cmd + Space**
2. Type `Terminal`
3. Press Enter

**Step 2: Install Xcode Command Line Tools**
1. Copy and paste this command:
```bash
xcode-select --install
```
2. Press **Enter**
3. A popup will appear asking to install - click **"Install"**
4. Click **"Agree"** to the license agreement
5. Wait for installation (5-20 minutes depending on internet speed)

**Step 3: Verify Installation**
```bash
xcode-select -p
```
Should show: `/Library/Developer/CommandLineTools`

> ❌ **If you get an error**: Try restarting your Mac and running the command again.

### 3.5 Install Homebrew (Mac's Package Manager)

Homebrew is like an "App Store for Terminal" - it makes installing developer tools easy.

**Step 1: Install Homebrew**
1. Copy this ENTIRE command (it's long!):
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
2. Paste it in Terminal
3. Press **Enter**
4. When prompted, enter your Mac password
   - **Note**: You won't see your password as you type - this is normal!
5. Press **Enter** when it asks to press RETURN
6. Wait for installation (5-10 minutes)

**Step 2: Add Homebrew to Your PATH (CRITICAL for M1/M2/M3!)**

After installation, Homebrew will show some commands you need to run. They look like:
```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Copy and run BOTH commands** from the terminal output!

> ⚠️ **M1/M2/M3 Macs**: Homebrew installs to `/opt/homebrew/` instead of `/usr/local/`. The commands above handle this automatically.

**Step 3: Verify Homebrew Installation**
1. Close Terminal completely (Cmd + Q)
2. Open a NEW Terminal window
3. Run:
```bash
brew --version
```
Should show: `Homebrew 4.x.x`

**Step 4: Update Homebrew**
```bash
brew update
brew upgrade
```

### 3.6 Install All Required Tools (Mac M1/M2/M3 One-Command Setup)

Now let's install everything you need with one set of commands!

**Step 1: Install Core Development Tools**
```bash
# Install Node.js (includes npm)
brew install node

# Install Git
brew install git

# Install AWS CLI
brew install awscli

# Install Supabase CLI
brew install supabase/tap/supabase
```

**Step 2: Verify All Installations**
```bash
echo "=== Checking installations ==="
echo "Node.js version:"
node --version

echo "npm version:"
npm --version

echo "Git version:"
git --version

echo "AWS CLI version:"
aws --version

echo "Supabase CLI version:"
supabase --version
```

You should see version numbers for each (no "command not found" errors).

### 3.7 Install VS Code for Mac

**Step 1: Download VS Code**
1. Open Safari or Chrome
2. Go to: `code.visualstudio.com`
3. Click the **"Download for Mac"** button
4. If asked, choose **"Apple Silicon"** (for M1/M2/M3)

**Step 2: Install VS Code**
1. Open **Finder**
2. Go to **Downloads**
3. Double-click the downloaded `.zip` file to extract it
4. Drag **Visual Studio Code.app** to **Applications** folder

**Step 3: Open VS Code**
1. Open **Applications** folder
2. Double-click **Visual Studio Code**
3. If macOS says "Visual Studio Code is from an unidentified developer":
   - Click **"Open"** in the dialog
   - Or go to System Preferences → Security & Privacy → Click "Open Anyway"

**Step 4: Add VS Code to Terminal PATH**
1. Open VS Code
2. Press **Cmd + Shift + P** to open Command Palette
3. Type: `shell command`
4. Click **"Shell Command: Install 'code' command in PATH"**
5. Enter your password if asked

Now you can open VS Code from Terminal:
```bash
code .  # Opens current folder in VS Code
```

### 3.8 Install Docker Desktop for Mac (Optional)

Docker lets you run databases locally for testing.

**Step 1: Download Docker**
1. Go to: `docker.com/products/docker-desktop`
2. Click **"Download for Mac"**
3. Choose **"Mac with Apple Chip"** (for M1/M2/M3)

**Step 2: Install Docker**
1. Open the downloaded `.dmg` file
2. Drag Docker to **Applications**
3. Open Docker from Applications
4. Click **"Open"** if macOS warns about the app
5. Accept the license agreement

**Step 3: Configure Docker for Apple Silicon**
1. Click the Docker icon in your menu bar (whale icon)
2. Click **"Settings"** (gear icon)
3. Go to **"General"**
4. Make sure **"Use Rosetta for x86/amd64 emulation"** is enabled (for compatibility)
5. Click **"Apply & Restart"**

**Step 4: Verify Docker**
```bash
docker --version
docker run hello-world
```

### 3.9 Set Up Git Configuration

**Configure Your Identity:**
```bash
git config --global user.name "Your Full Name"
git config --global user.email "your-email@example.com"
```

Replace with your actual name and the email you'll use for GitHub.

**Configure Default Branch:**
```bash
git config --global init.defaultBranch main
```

**Configure Text Editor:**
```bash
git config --global core.editor "code --wait"
```

**Verify Configuration:**
```bash
git config --list
```

### 3.10 Create Your Project Folder

Let's organize where your code will live:

```bash
# Go to home directory
cd ~

# Create a Projects folder
mkdir -p Projects

# Go into it
cd Projects

# Verify you're there
pwd
```
Should show: `/Users/yourusername/Projects`

---

## 4. Step 1: Create Your Supabase Account

### 4.1 What is Supabase? (In Simple Terms)
Think of Supabase as a "smart filing cabinet in the cloud". It stores all your data (users, interviews, questions) and handles user login/logout automatically.

### 4.2 Create Your Account - Click by Click

**Step A: Go to the Website**
1. Open your web browser (Chrome, Firefox, Safari, etc.)
2. In the address bar at the top, type: `supabase.com`
3. Press Enter on your keyboard
4. You should see a green website with "Build in a weekend. Scale to millions." text

**Step B: Start Sign Up**
1. Look for a green button that says **"Start your project"** (usually top-right or center)
2. Click it
3. You'll see a sign-up page

**Step C: Choose Sign Up Method**
You have two options:

**Option 1: Sign up with GitHub (Recommended)**
- If you have a GitHub account, click **"Continue with GitHub"**
- You'll be asked to authorize Supabase to access your GitHub
- Click **"Authorize supabase"**
- Done! You're logged in.

**Option 2: Sign up with Email**
- Click **"Sign up with email"**
- Enter your email address
- Create a password (must be at least 6 characters)
- Click **"Sign up"**
- Check your email inbox for a verification email
- Click the link in the email
- Done! You're logged in.

> 💡 **Tip**: If you don't see the verification email, check your Spam/Junk folder.

### 4.3 Create Your First Project - Click by Click

**Step A: Create Organization (if prompted)**
1. You might see "Create Organization" screen
2. Organization Name: Enter your company name or just "My Production"
3. Plan: Select **"Free"** (you can upgrade later)
4. Click **"Create organization"**

**Step B: Create New Project**
1. Click the green **"New Project"** button
2. You'll see a form with these fields:

**Fill in the form:**
```
Organization: [Select the one you just created]

Project name: ias-platform-production
             (or any name you like - no spaces!)

Database Password: 
   ┌─────────────────────────────────────────────────┐
   │ Click "Generate a password" button OR          │
   │ Type your own strong password like:            │
   │ MyStr0ng#Pass2024!                             │
   │                                                 │
   │ ⚠️ WRITE THIS DOWN! You'll need it later!      │
   └─────────────────────────────────────────────────┘

Region: [Select the one closest to your users]
        - If your users are in India: Mumbai
        - If your users are in US: Choose any US region
        - If your users are in Europe: Choose Frankfurt or London

Pricing Plan: Free (you can change later)
```

3. Click **"Create new project"**

**Step C: Wait for Setup**
- You'll see a loading screen saying "Setting up your project"
- This takes 2-5 minutes
- Don't close the browser!
- When done, you'll see your project dashboard

### 4.4 Get Your Supabase Credentials (IMPORTANT!)

Now we need to copy some secret codes. Think of these like passwords that let your app talk to Supabase.

**Step A: Go to Settings**
1. Look at the left sidebar (the menu on the left side)
2. Find the ⚙️ **Settings** icon (usually at the bottom)
3. Click it

**Step B: Go to API Settings**
1. In the Settings menu, click **"API"**
2. You'll see a page with various keys and URLs

**Step C: Copy These Values**
Create a text file on your computer called `MY_CREDENTIALS.txt` and save these:

```
=== MY SUPABASE CREDENTIALS ===
(Created on: [today's date])

1. Project URL:
   [Copy the URL under "Project URL"]
   It looks like: https://abcdefghijk.supabase.co

2. Anon/Public Key:
   [Copy the long key under "anon public"]
   It starts with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
3. Service Role Key (SECRET - never share!):
   [Click "Reveal" next to service_role]
   [Copy the long key]
   It also starts with: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   
4. Database Password:
   [The password you created in step 3.3]
```

**Step D: Get Database Connection String**
1. Still in Settings, click **"Database"** in the left menu
2. Scroll down to find **"Connection string"**
3. Click on **"URI"** tab
4. Copy the connection string - it looks like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.abcdefghijk.supabase.co:5432/postgres
   ```
5. Add this to your credentials file

> ⚠️ **SECURITY WARNING**: 
> - The `service_role` key is like a master password. NEVER put it in your website code!
> - Keep your `MY_CREDENTIALS.txt` file safe and private
> - Never upload it to GitHub or share it publicly

### 4.5 Where to Find Things in Supabase Dashboard

Here's a map of the Supabase dashboard:

```
┌────────────────────────────────────────────────────────────────┐
│  Supabase Dashboard                                             │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌──────────────────────────────────────────┐ │
│  │ Left Menu   │  │  Main Content Area                       │ │
│  │             │  │                                          │ │
│  │ 🏠 Home     │  │  This is where you see tables,          │ │
│  │ 📊 Table    │  │  run queries, manage users, etc.        │ │
│  │    Editor   │  │                                          │ │
│  │ ⚡ Edge     │  │                                          │ │
│  │    Functions│  │                                          │ │
│  │ 🔐 Auth     │  │                                          │ │
│  │ 📁 Storage  │  │                                          │ │
│  │ 📝 SQL      │  │                                          │ │
│  │    Editor   │  │                                          │ │
│  │ 📋 Logs     │  │                                          │ │
│  │ ⚙️ Settings │  │                                          │ │
│  └─────────────┘  └──────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

---

## 5. Step 2: Create Your AWS Account

### 5.1 What is AWS? (In Simple Terms)
AWS is like renting a computer from Amazon that runs 24/7. Your website will live there so anyone can access it anytime.

### 5.2 Create Your Account - Click by Click

**Step A: Go to AWS Website**
1. Open your browser
2. Go to: `aws.amazon.com`
3. Click the orange **"Create an AWS Account"** button (top right)

**Step B: Enter Root User Email**
1. Enter your email address
2. AWS account name: `IAS-Platform-Production`
3. Click **"Verify email address"**

**Step C: Verify Your Email**
1. Check your email inbox
2. Find the email from AWS with a verification code
3. Enter the code on the AWS website
4. Click **"Verify"**

**Step D: Create Root Password**
1. Create a strong password (at least 8 characters, with numbers and symbols)
2. Confirm the password
3. Click **"Continue"**

> 💡 **Save this password in your credentials file!**

**Step E: Enter Contact Information**
1. Choose **"Personal"** or **"Business"** (Personal is fine for testing)
2. Fill in:
   - Full Name
   - Phone Number
   - Country
   - Address
3. Read and check the AWS Customer Agreement box
4. Click **"Continue"**

**Step F: Enter Payment Information**
1. Enter your credit/debit card details
2. Enter billing address
3. Click **"Verify and Add"**

> 💡 **Don't worry!** AWS won't charge you if you stay within the free tier. They just need a card for verification.

**Step G: Verify Your Phone Number**
1. Enter your phone number
2. Choose SMS or Voice call
3. Click **"Send SMS"** or **"Call me now"**
4. Enter the verification code you receive
5. Click **"Continue"**

**Step H: Choose Support Plan**
1. Select **"Basic support - Free"**
2. Click **"Complete sign up"**

**Step I: Wait for Activation**
- You'll see "Congratulations" message
- Account activation can take a few minutes to 24 hours
- You'll receive an email when it's ready

### 5.3 CRITICAL: Secure Your AWS Account

> ⚠️ **WARNING**: Hackers actively try to steal AWS credentials. If they get in, they can run expensive servers and charge thousands to your card! Follow these security steps.

**Step A: Enable MFA (Two-Factor Authentication)**

1. Go to: `console.aws.amazon.com`
2. Sign in with your root email and password
3. Click your account name (top right corner)
4. Click **"Security credentials"**
5. Find **"Multi-factor authentication (MFA)"**
6. Click **"Assign MFA device"**
7. Choose **"Authenticator app"** → **"Next"**
8. On your phone:
   - Download "Google Authenticator" or "Authy" from your app store
   - Open the app
   - Scan the QR code shown on AWS
   - Enter the two codes from the app
9. Click **"Add MFA"**

> 🎉 Now even if someone gets your password, they can't log in without your phone!

**Step B: Create an IAM User (Don't Use Root for Daily Tasks)**

The root account is like the master key. Create a separate user for daily work.

1. Go to: `console.aws.amazon.com/iam`
2. In left menu, click **"Users"**
3. Click **"Create user"** (blue button)
4. User name: `ias-admin`
5. Check ☑️ **"Provide user access to the AWS Management Console"**
6. Select **"I want to create an IAM user"**
7. Choose **"Custom password"** and enter a password
8. Uncheck "Users must create a new password" (optional)
9. Click **"Next"**

**Step C: Set Permissions**
1. Select **"Attach policies directly"**
2. In the search box, type: `AdministratorAccess`
3. Check the box next to **"AdministratorAccess"**
4. Click **"Next"**
5. Click **"Create user"**

**Step D: Save Your IAM User Credentials**
1. You'll see a success page with a sign-in URL
2. Save these in your credentials file:
```
=== AWS IAM USER ===
Sign-in URL: https://123456789012.signin.aws.amazon.com/console
Username: ias-admin
Password: [the password you created]
```

### 5.4 Create AWS Access Keys (For Command Line)

**Step A: Go to Security Credentials**
1. Sign in as your IAM user (use the sign-in URL from above)
2. Click your username (top right)
3. Click **"Security credentials"**

**Step B: Create Access Key**
1. Scroll down to **"Access keys"**
2. Click **"Create access key"**
3. Select **"Command Line Interface (CLI)"**
4. Check the confirmation box at the bottom
5. Click **"Next"**
6. Description: `IAS Platform Deployment`
7. Click **"Create access key"**

**Step C: SAVE YOUR KEYS IMMEDIATELY**
```
=== AWS ACCESS KEYS ===
Access key ID: AKIA...
Secret access key: wJalrXUtnFEMI...

⚠️ THIS IS SHOWN ONLY ONCE! IF YOU LOSE IT, YOU MUST CREATE NEW KEYS!
```

8. Click **"Download .csv file"** as backup
9. Click **"Done"**

---

## 6. Step 3: Get Your OpenAI API Key

### 6.1 What is OpenAI? (In Simple Terms)
OpenAI is the company behind ChatGPT. Their API lets your app use AI to:
- Generate interview questions automatically
- Evaluate candidate answers
- Analyze proctoring videos for cheating

### 6.2 Create Your Account - Click by Click

**Step A: Go to OpenAI Platform**
1. Open browser
2. Go to: `platform.openai.com` (NOT chatgpt.com!)
3. Click **"Sign up"**

**Step B: Create Account**
1. Choose to sign up with:
   - Google account (easiest), OR
   - Microsoft account, OR
   - Email
2. If using email:
   - Enter your email
   - Create a password
   - Click **"Continue"**
   - Verify your email
3. Fill in your name and birthday
4. Verify your phone number

### 6.3 Add Payment Method

**Step A: Go to Billing**
1. Click your profile icon (top right)
2. Click **"Billing"**
3. Or go directly to: `platform.openai.com/account/billing`

**Step B: Add Credits**
1. Click **"Add payment details"**
2. Enter your card information
3. Choose an initial amount:
   - $5 is enough to start testing
   - $20 is good for a few months of light use
4. Click **"Continue"**

**Step C: Set Spending Limit (Recommended)**
1. Click **"Usage limits"** in the billing menu
2. Set "Monthly budget" to $20 (or your preferred limit)
3. This prevents unexpected charges!

### 6.4 Create Your API Key

**Step A: Go to API Keys**
1. Click your profile icon (top right)
2. Click **"API keys"**
3. Or go to: `platform.openai.com/api-keys`

**Step B: Create New Key**
1. Click **"Create new secret key"**
2. Name: `IAS-Platform-Production`
3. Click **"Create secret key"**

**Step C: SAVE THE KEY IMMEDIATELY**
```
=== OPENAI API KEY ===
sk-proj-ABC123...

⚠️ THIS IS SHOWN ONLY ONCE! COPY IT NOW!
```

4. Click the copy icon
5. Paste it into your credentials file
6. Click **"Done"**

### 6.5 Your OpenAI Credentials

Add to your `CREDENTIALS.txt`:

```
=== OPENAI CREDENTIALS ===
API Key: sk-proj-... (SECRET!)
Organization ID: org-... (if applicable)
```

---

## 7. Step 4: Set Up Your Domain (Optional)

If you want a custom domain like `interviews.yourcompany.com`:

### 7.1 Purchase a Domain

**Option A: Namecheap** (Recommended for beginners)
1. Go to: https://www.namecheap.com
2. Search for your desired domain
3. Add to cart and purchase (~$10-15/year for .com)

**Option B: AWS Route 53**
1. Go to: https://console.aws.amazon.com/route53
2. Click **"Registered domains"** → **"Register domain"**
3. Search and purchase

### 7.2 Get an SSL Certificate (For HTTPS)

We'll do this later during AWS setup with AWS Certificate Manager (free).

---

## 8. Step 5: Install Required Tools

> 🍎 **Mac M1/M2/M3 Users**: If you followed Section 3, you've already installed these tools! Skip to [Section 9](#9-step-6-clone-and-configure-the-project).

> 📝 **What are these tools?**
> - **Node.js**: Runs JavaScript on your computer (needed to build the app)
> - **Git**: Tracks code changes and downloads code from GitHub
> - **VS Code**: A text editor for viewing and editing code
> - **AWS CLI**: Lets you control AWS from command line
> - **Supabase CLI**: Lets you control Supabase from command line

### 8.1 Install Node.js - Step by Step

#### For Windows Users:

**Step 1: Download Node.js**
1. Open your browser
2. Go to: `nodejs.org`
3. You'll see two big green buttons
4. Click the one that says **"LTS"** (Long Term Support) - this is the stable version
5. A file will download (something like `node-v20.x.x-x64.msi`)

**Step 2: Install Node.js**
1. Find the downloaded file (usually in Downloads folder)
2. Double-click it to run
3. Click **"Next"** on the welcome screen
4. Check "I accept the terms" and click **"Next"**
5. Leave the installation path as default, click **"Next"**
6. Leave all features selected, click **"Next"**
7. Click **"Install"**
8. If Windows asks "Do you want to allow this app to make changes?" click **"Yes"**
9. Wait for installation to complete
10. Click **"Finish"**

**Step 3: Verify Installation**
1. Press `Windows + R` on your keyboard
2. Type `cmd` and press Enter
3. A black window (Command Prompt) opens
4. Type: `node --version` and press Enter
5. You should see something like: `v20.10.0`
6. Type: `npm --version` and press Enter
7. You should see something like: `10.2.3`

> ❌ **If you see "node is not recognized"**: Restart your computer and try again.

#### For Mac Users:

**Option A: Download from Website (Easier)**
1. Go to: `nodejs.org`
2. Click the **"LTS"** button
3. Open the downloaded `.pkg` file
4. Follow the installer steps

**Option B: Using Terminal (Better for developers)**
1. Open **Terminal** (search for it in Spotlight: Cmd + Space, type "Terminal")
2. First, install Homebrew (a package manager) by pasting this command:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
3. Press Enter and wait (this takes a few minutes)
4. Enter your Mac password when asked (you won't see it as you type - that's normal)
5. Once done, install Node.js:
```bash
brew install node
```
6. Verify:
```bash
node --version
npm --version
```

### 8.2 Install Git - Step by Step

#### For Windows Users:

**Step 1: Download Git**
1. Go to: `git-scm.com/download/win`
2. The download should start automatically
3. If not, click the link for your system (usually "64-bit Git for Windows Setup")

**Step 2: Install Git**
1. Run the downloaded file
2. Click **"Yes"** if Windows asks for permission
3. Click **"Next"** on the information screen
4. Leave installation location as default, click **"Next"**
5. **Components screen**: Leave defaults, click **"Next"**
6. **Start menu folder**: Leave default, click **"Next"**
7. **Default editor**: Select **"Use Visual Studio Code"** (if installed), otherwise leave default
8. Click **"Next"** through remaining screens (defaults are fine)
9. Click **"Install"**
10. Click **"Finish"**

**Step 3: Verify**
1. Open Command Prompt (Windows + R, type `cmd`, Enter)
2. Type: `git --version`
3. You should see: `git version 2.x.x`

#### For Mac Users:

1. Open Terminal
2. Type: `git --version`
3. If Git isn't installed, Mac will prompt you to install developer tools
4. Click **"Install"** when prompted
5. Wait for installation
6. Verify again: `git --version`

### 8.3 Install VS Code - Step by Step

**Step 1: Download**
1. Go to: `code.visualstudio.com`
2. Click the big blue **"Download"** button
3. It will detect your operating system automatically

**Step 2: Install**
- **Windows**: Run the `.exe` file, follow prompts
- **Mac**: Open the `.zip`, drag VS Code to Applications folder

**Step 3: Open and Configure**
1. Open VS Code
2. Click the **Extensions** icon (looks like 4 squares) in the left sidebar
3. Search and install these helpful extensions:
   - **ESLint** - Finds code errors
   - **Prettier** - Formats code nicely
   - **GitLens** - Better Git integration

### 8.4 Install AWS CLI - Step by Step

#### For Windows Users:

**Step 1: Download**
1. Go to: `aws.amazon.com/cli/`
2. Click **"Download and run the Windows 64-bit installer"**
3. Or direct link: `https://awscli.amazonaws.com/AWSCLIV2.msi`

**Step 2: Install**
1. Run the downloaded `.msi` file
2. Click **"Next"** through all screens
3. Click **"Install"**
4. Click **"Finish"**

**Step 3: Configure AWS CLI**
1. Open Command Prompt (Windows + R, type `cmd`, Enter)
2. Type: `aws configure` and press Enter
3. You'll be asked for 4 things:

```
AWS Access Key ID [None]: AKIA... (paste your access key from Step 4.4)
AWS Secret Access Key [None]: wJalrX... (paste your secret key)
Default region name [None]: us-east-1 (or ap-south-1 for India)
Default output format [None]: json
```

**Step 4: Verify**
```bash
aws sts get-caller-identity
```
If successful, you'll see your account ID and ARN.

#### For Mac Users:

1. Open Terminal
2. Install via Homebrew:
```bash
brew install awscli
```
3. Configure:
```bash
aws configure
```
4. Enter your credentials as shown above

### 8.5 Install Supabase CLI - Step by Step

**Step 1: Install via npm**
Open Terminal (Mac) or Command Prompt (Windows):
```bash
npm install -g supabase
```

> 💡 The `-g` means "global" - install it so you can use it from anywhere.

**Step 2: Verify Installation**
```bash
supabase --version
```
You should see something like: `1.x.x`

**Step 3: Login to Supabase**
```bash
supabase login
```
This will:
1. Open your browser
2. Show a Supabase authorization page
3. Click **"Authorize"**
4. You'll see "Authorization complete" in browser
5. Terminal will say "Finished supabase login"

> ❌ **If browser doesn't open**: Copy the URL from terminal and paste in browser manually.

### 8.6 Install Docker (Optional but Helpful)

Docker lets you run the database locally for testing. Skip this if you want to keep things simple.

**Windows:**
1. Go to: `docker.com/products/docker-desktop`
2. Download Docker Desktop for Windows
3. Run the installer
4. Restart your computer when prompted
5. Open Docker Desktop from Start menu
6. Wait for it to start (the whale icon will stop animating)

**Mac:**
1. Go to: `docker.com/products/docker-desktop`
2. Download Docker Desktop for Mac
3. Open the `.dmg` file
4. Drag Docker to Applications
5. Open Docker from Applications
6. Wait for it to start

**Verify:**
```bash
docker --version
```

---

## 9. Step 6: Clone and Configure the Project

### 9.1 Understanding Git and GitHub

**What is Git?** A tool that tracks changes to files, like "Track Changes" in Word but for code.

**What is GitHub?** A website that stores Git repositories (projects) online.

**What is "Cloning"?** Downloading a project from GitHub to your computer.

### 9.2 Set Up GitHub Account (If You Don't Have One)

1. Go to: `github.com`
2. Click **"Sign up"**
3. Enter your email, create password, choose username
4. Verify your email
5. Complete the setup wizard

### 9.3 Fork the Repository (Create Your Own Copy)

**Why Fork?** So you have your own copy that you control completely.

1. Go to the project's GitHub page
2. Click the **"Fork"** button (top right)
3. Select your account as the destination
4. Wait for the fork to complete
5. You now have your own copy at: `github.com/YOUR-USERNAME/ias-platform`

### 9.4 Clone the Project to Your Computer

**Step 1: Open Terminal/Command Prompt**
- Windows: Press Windows + R, type `cmd`, press Enter
- 🍎 Mac: Press Cmd + Space, type "Terminal", press Enter

**Step 2: Navigate to Where You Want the Project**
```bash
# On Windows:
cd C:\Users\YourName\Documents

# 🍎 On Mac (use the Projects folder we created earlier):
cd ~/Projects
```

> 💡 `cd` means "change directory" (go to folder)

**Step 3: Clone Your Fork**
```bash
git clone https://github.com/YOUR-USERNAME/ias-platform.git
```

Replace `YOUR-USERNAME` with your actual GitHub username.

You'll see output like:
```
Cloning into 'ias-platform'...
remote: Enumerating objects: 1234, done.
remote: Counting objects: 100% (1234/1234), done.
...
```

**Step 4: Enter the Project Directory**
```bash
cd ias-platform
```

**Step 5: Install Dependencies**
```bash
npm install
```

This downloads all the code libraries the project needs. Takes 2-5 minutes.

> 🍎 **Mac M1/M2/M3 Note**: If you see any errors about "native modules" or "arm64", most can be ignored as the project doesn't rely on native binaries. If npm install fails completely, try:
> ```bash
> rm -rf node_modules package-lock.json
> npm install
> ```

You'll see lots of output. Wait until you see a prompt again.

### 9.5 Create Environment Configuration File

**Step 1: Create the File**

🍎 **Mac Users - Using Terminal (Easier):**
```bash
# Make sure you're in the project folder
cd ~/Projects/ias-platform

# Create the file
touch .env.production

# Open in VS Code
code .env.production
```

**Or Using VS Code:**
1. Open VS Code
2. File → Open Folder → Select the `ias-platform` folder
3. In the file explorer (left side), right-click in empty space
4. Click **"New File"**
5. Name it: `.env.production`

**Step 2: Add Your Credentials**

Copy this template and fill in YOUR values from your credentials file:

```env
# ===========================================
# PRODUCTION ENVIRONMENT CONFIGURATION
# Created: [TODAY'S DATE]
# ===========================================

# ===== SUPABASE CONFIGURATION =====
# From: Supabase Dashboard → Settings → API
VITE_SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_ANON_KEY

# For edge functions (SECRET - don't expose!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.YOUR_SERVICE_ROLE_KEY
SUPABASE_DB_URL=postgresql://postgres:YOUR_DB_PASSWORD@db.YOUR-PROJECT-ID.supabase.co:5432/postgres

# ===== OPENAI CONFIGURATION =====
# From: platform.openai.com → API Keys
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_API_KEY

# ===== APPLICATION CONFIGURATION =====
VITE_APP_URL=https://your-domain.com
NODE_ENV=production

# ===== EMAIL CONFIGURATION (Optional) =====
# Only fill these if you want to send emails
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password
```

**Step 3: Save the File**
Press `Ctrl + S` (Windows) or `Cmd + S` (Mac)

> ⚠️ **IMPORTANT**: This file is in `.gitignore` so it won't be uploaded to GitHub. Keep it safe!

---

## 10. Step 7: Set Up Supabase Database

### 10.1 Link Your Local Project to Supabase

**Step 1: Open Terminal in Project Folder**
- In VS Code: Terminal → New Terminal
- 🍎 Mac: Or open Terminal and run `cd ~/Projects/ias-platform`

**Step 2: Login to Supabase CLI (if not already)**
```bash
supabase login
```

**Step 3: Link to Your Project**
```bash
supabase link --project-ref YOUR-PROJECT-ID
```

Replace `YOUR-PROJECT-ID` with your actual project ID (the random letters/numbers from your Supabase URL).

You'll be asked for your database password (the one you saved earlier).

**Expected Output:**
```
Enter your database password: [type password, won't show]
Finished supabase link.
```

### 10.2 Run Database Migrations - Step by Step

**What are Migrations?**
Migrations are like instructions that tell the database how to set up tables, columns, and rules. The project has 171 migration files that create everything automatically.

**Step 1: Push Migrations**
```bash
supabase db push
```

**What You'll See:**
```
Applying migration 20240101000000_initial_schema.sql...
Applying migration 20240102000001_add_users.sql...
...
Finished supabase db push.
```

This creates:
- All database tables (users, interviews, questions, etc.)
- Security rules (who can see/edit what)
- Helper functions

**Step 2: If You See Errors**

Error: "migration failed"
```bash
# Reset and try again
supabase db reset
supabase db push
```

Error: "permission denied"
- Check your database password is correct
- Try: `supabase link` again with correct password

### 9.3 Verify Everything Works

**Check 1: View Tables in Supabase Dashboard**

1. Open: `supabase.com/dashboard`
2. Click on your project
3. Click **"Table Editor"** in left menu
4. You should see tables like:
   - `profiles` - User information
   - `organizations` - Companies
   - `interviews` - Interview configurations
   - `questions` - Interview questions
   - `interview_attempts` - Candidate attempts
   - `proctoring_sessions` - Proctoring data
   - And many more...

**Check 2: View Storage Buckets**

1. Click **"Storage"** in left menu
2. You should see buckets like:
   - `proctoring-recordings` - Video recordings
   - `documents` - Uploaded files

### 9.4 Create Your First Admin User - Step by Step

**Step 1: Create the User Account**

1. In Supabase Dashboard, click **"Authentication"** in left menu
2. Click the **"Users"** tab
3. Click **"Add user"** button (top right)
4. Select **"Create new user"**
5. Fill in:
   ```
   Email: admin@yourcompany.com (use your real email)
   Password: Create a strong password
   ☑️ Check "Auto Confirm User" checkbox
   ```
6. Click **"Create user"**

**Step 2: Find the User ID**

1. In the Users list, find the user you just created
2. Click on them
3. Copy the **"User UID"** - it looks like: `a1b2c3d4-e5f6-g7h8-i9j0-k1l2m3n4o5p6`

**Step 3: Assign Admin Role**

1. Click **"SQL Editor"** in left menu
2. Click **"New query"**
3. Paste this SQL (replace values with yours):

```sql
-- Step 1: Add the platform_admin role
INSERT INTO public.user_roles (user_id, role)
VALUES (
  'PASTE-YOUR-USER-ID-HERE',  -- Replace with the User UID you copied
  'platform_admin'
);

-- Step 2: Create the profile
INSERT INTO public.profiles (id, full_name, email)
VALUES (
  'PASTE-YOUR-USER-ID-HERE',  -- Same User UID
  'Admin User',               -- Your name
  'admin@yourcompany.com'     -- Same email you used
);
```

4. Click **"Run"** (or press F5)
5. You should see: "Success. No rows returned"

**Step 4: Test Login**

1. Go to your app URL (we'll deploy it next)
2. Try logging in with the email and password you created
3. You should see the admin dashboard!

```bash
# Link to your project
supabase link --project-ref [your-project-id]

# You'll be asked for your database password
```

### 9.2 Run Database Migrations

The project has 171 migrations that set up all tables, functions, and policies:

```bash
# Push all migrations to your Supabase database
supabase db push
```

This will:
- Create all tables (interviews, questions, users, etc.)
- Set up Row Level Security policies
- Create database functions and triggers
- Set up storage buckets

**If you see errors:**
```bash
# Reset and try again
supabase db reset
supabase db push
```

### 9.3 Verify Database Setup

1. **Go to Supabase Dashboard**
   - https://supabase.com/dashboard
   - Select your project

2. **Check Tables**
   - Click **"Table Editor"** in sidebar
   - You should see tables like:
     - `profiles`
     - `organizations`
     - `interviews`
     - `questions`
     - `interview_attempts`
     - etc.

3. **Check Storage**
   - Click **"Storage"** in sidebar
   - You should see buckets like:
     - `proctoring-recordings`
     - `documents`

### 9.4 Create First Admin User

1. **Go to Authentication**
   - Click **"Authentication"** in Supabase sidebar
   - Click **"Users"** tab

2. **Create User**
   - Click **"Add user"** → **"Create new user"**
   ```
   Email: admin@yourcompany.com
   Password: [strong password]
   ☑️ Auto Confirm User
   ```

3. **Set Admin Role** (in SQL Editor)
   - Click **"SQL Editor"** in sidebar
   - Run this query (replace the email):
   ```sql
   -- Get the user ID
   SELECT id FROM auth.users WHERE email = 'admin@yourcompany.com';
   
   -- Add platform_admin role (replace USER_ID with actual ID)
   INSERT INTO public.user_roles (user_id, role)
   VALUES ('USER_ID_HERE', 'platform_admin');
   
   -- Create profile
   INSERT INTO public.profiles (id, full_name, email)
   VALUES ('USER_ID_HERE', 'Admin User', 'admin@yourcompany.com');
   ```

---

## 🎯 MY FIRST DEPLOYMENT: The Easiest Path (Vercel + Supabase)

> **⏱️ Time needed: 1-2 hours**
> **💰 Cost: FREE to start ($0/month for small projects)**
> **🎯 This is the RECOMMENDED path for beginners!**

This section shows you the SIMPLEST way to get your app live on the internet. We'll use:
- **Vercel** - Free hosting for your website (like AWS but much simpler!)
- **Supabase** - Your own Supabase account for the database

### Why Vercel Instead of AWS?

| Feature | Vercel | AWS Amplify |
|---------|--------|-------------|
| **Setup Difficulty** | ⭐ Very Easy | ⭐⭐⭐ Medium |
| **Time to Deploy** | 5 minutes | 30-60 minutes |
| **Free Tier** | Generous | Limited |
| **Auto-deploys from GitHub** | ✅ Yes | ✅ Yes |
| **Custom Domain** | ✅ Free | ✅ Free |
| **Best For** | Beginners | Large enterprises |

### Step D1: Create a Vercel Account (2 minutes)

1. **Open your browser** and go to: `https://vercel.com`

2. **Click "Sign Up"** (top right corner)

3. **Sign up with GitHub** (easiest!)
   ```
   ┌─────────────────────────────────────────────┐
   │  Continue with...                            │
   ├─────────────────────────────────────────────┤
   │                                              │
   │  ┌──────────────────────────────────────┐   │
   │  │  🐙  Continue with GitHub            │   │  ← Click this!
   │  └──────────────────────────────────────┘   │
   │                                              │
   │  ┌──────────────────────────────────────┐   │
   │  │  🔷  Continue with GitLab            │   │
   │  └──────────────────────────────────────┘   │
   │                                              │
   │  ┌──────────────────────────────────────┐   │
   │  │  📧  Continue with Email             │   │
   │  └──────────────────────────────────────┘   │
   │                                              │
   └─────────────────────────────────────────────┘
   ```

4. **Authorize Vercel** to access your GitHub
   - A popup appears asking for permission
   - Click **"Authorize Vercel"**

5. **Complete your profile**
   - Enter your name
   - Skip any optional steps
   - Click **"Continue"**

**✅ Done!** You now have a Vercel account.

### Step D2: Push Your Code to GitHub (If Not Already Done)

If you exported from Lovable, your code might already be on GitHub. Check by going to `github.com` and looking for your repository.

**If your code is NOT on GitHub yet:**

#### 🍎 Mac:

```bash
# Navigate to your project folder
cd ~/Projects/talentgeenie

# Initialize Git (if not already)
git init

# Add all files
git add .

# Create your first commit
git commit -m "Initial commit"

# Create a GitHub repository (visit github.com/new in your browser)
# Then link your local repo to GitHub:
git remote add origin https://github.com/YOUR_USERNAME/talentgeenie.git

# Push your code
git push -u origin main
```

#### 🪟 Windows:

```cmd
:: Navigate to your project folder
cd %USERPROFILE%\Documents\Projects\talentgeenie

:: Initialize Git (if not already)
git init

:: Add all files
git add .

:: Create your first commit
git commit -m "Initial commit"

:: Create a GitHub repository (visit github.com/new in your browser)
:: Then link your local repo to GitHub:
git remote add origin https://github.com/YOUR_USERNAME/talentgeenie.git

:: Push your code
git push -u origin main
```

### Step D3: Deploy to Vercel (5 minutes!)

1. **Go to Vercel Dashboard**: `https://vercel.com/dashboard`

2. **Click "Add New..." → "Project"**
   ```
   ┌─────────────────────────────────────────────┐
   │  Vercel Dashboard                            │
   ├─────────────────────────────────────────────┤
   │                                              │
   │  [+ Add New...] ← Click this dropdown       │
   │      │                                       │
   │      ├── Project      ← Then click this     │
   │      ├── Domain                              │
   │      └── Team Member                         │
   │                                              │
   └─────────────────────────────────────────────┘
   ```

3. **Import your GitHub repository**
   - You'll see a list of your GitHub repos
   - Find `talentgeenie` (or your project name)
   - Click the **"Import"** button next to it
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  Import Git Repository                                   │
   ├─────────────────────────────────────────────────────────┤
   │                                                          │
   │  talentgeenie                           [Import]        │
   │  Updated 2 hours ago                                     │
   │                                                          │
   │  other-project                          [Import]        │
   │  Updated 5 days ago                                      │
   │                                                          │
   └─────────────────────────────────────────────────────────┘
   ```

4. **Configure Project Settings**
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  Configure Project                                       │
   ├─────────────────────────────────────────────────────────┤
   │                                                          │
   │  Project Name: talentgeenie                             │
   │  (This will be your URL: talentgeenie.vercel.app)       │
   │                                                          │
   │  Framework Preset: [Vite]  ← Vercel auto-detects this!  │
   │                                                          │
   │  Root Directory: ./                                      │
   │                                                          │
   │  Build Command: npm run build (auto-detected)           │
   │  Output Directory: dist (auto-detected)                  │
   │                                                          │
   └─────────────────────────────────────────────────────────┘
   ```

5. **⚠️ CRITICAL: Add Environment Variables**
   
   Click **"Environment Variables"** to expand the section
   
   Add these one by one (click "Add" after each):
   
   | Name | Value | Example |
   |------|-------|---------|
   | `VITE_SUPABASE_URL` | Your Supabase project URL | `https://abcdefgh.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key | `eyJhbGciOi...` |
   
   ```
   ┌─────────────────────────────────────────────────────────┐
   │  Environment Variables                                   │
   ├─────────────────────────────────────────────────────────┤
   │                                                          │
   │  NAME                        VALUE                       │
   │  ┌──────────────────┐        ┌────────────────────────┐ │
   │  │VITE_SUPABASE_URL │        │https://abc.supabase.co │ │
   │  └──────────────────┘        └────────────────────────┘ │
   │                                                 [Add]   │
   │                                                          │
   │  ┌──────────────────────┐    ┌────────────────────────┐ │
   │  │VITE_SUPABASE_ANON_KEY│    │eyJhbGciOiJIUz...      │ │
   │  └──────────────────────┘    └────────────────────────┘ │
   │                                                 [Add]   │
   │                                                          │
   └─────────────────────────────────────────────────────────┘
   ```

   > **📝 Where to find these values:**
   > - Go to `supabase.com/dashboard` → Your Project → Settings → API
   > - Copy "Project URL" → paste as `VITE_SUPABASE_URL`
   > - Copy "anon public" key → paste as `VITE_SUPABASE_ANON_KEY`

6. **Click "Deploy"!**
   
   ```
   ┌─────────────────────────────────────────────────────────┐
   │                                                          │
   │                    [   Deploy   ]                        │
   │                    ↑ Click this big button!              │
   │                                                          │
   └─────────────────────────────────────────────────────────┘
   ```

7. **Wait for build (2-3 minutes)**
   
   You'll see a live build log:
   ```
   ✓ Installing dependencies...
   ✓ Building project...
   ✓ Uploading build outputs...
   ✓ Assigning domains...
   
   🎉 Congratulations! Your project has been deployed!
   ```

8. **Your app is LIVE!**
   
   Vercel gives you a URL like: `https://talentgeenie.vercel.app`
   
   Click the URL to see your live app!

### Step D4: Deploy Edge Functions to Supabase

The frontend is live, but the AI features need Edge Functions deployed to Supabase.

1. **Open Terminal/Command Prompt** in your project folder

2. **Login to Supabase CLI**
   ```bash
   supabase login
   ```
   - A browser opens
   - Click **"Authorize"**
   - Copy the token shown
   - Paste it back in Terminal
   - Press Enter

3. **Link to your Supabase project**
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```
   
   > **📝 How to find your project ID:**
   > - Go to `supabase.com/dashboard` → Your Project → Settings → General
   > - Look for "Reference ID" - it's something like `abcdefghijklmnop`

4. **Deploy all Edge Functions**
   ```bash
   supabase functions deploy
   ```
   
   You'll see each function being deployed:
   ```
   Deploying function: generate-questions
   Deploying function: evaluate-interview
   Deploying function: send-email
   ... (70+ functions)
   
   ✅ All functions deployed successfully!
   ```

5. **Set your API keys** (for AI features)
   ```bash
   # Set OpenAI key
   supabase secrets set OPENAI_API_KEY=sk-your-openai-key-here
   
   # Set Google Gemini key (optional, recommended as backup)
   supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key-here
   ```

   > **📝 Where to get these keys:**
   > - OpenAI: `platform.openai.com/api-keys` → Create new key
   > - Google Gemini: `makersuite.google.com/app/apikey` → Create key

### Step D5: Configure Supabase Auth

1. **Go to Supabase Dashboard** → Your Project → Authentication → URL Configuration

2. **Add your Vercel URL to allowed redirects:**
   ```
   Site URL: https://talentgeenie.vercel.app
   Redirect URLs: https://talentgeenie.vercel.app/*
   ```

3. **Save changes**

---

## ✅ VERIFICATION CHECKLIST: Is Everything Working?

Use this checklist to verify your deployment is complete and working.

### 🔍 Quick Health Check (2 minutes)

Open your deployed app URL (e.g., `https://talentgeenie.vercel.app`) and check:

| # | Check | How to Test | Expected Result | Status |
|---|-------|-------------|-----------------|--------|
| 1 | **Site loads** | Open URL in browser | Landing page appears | ☐ |
| 2 | **No errors** | Open browser console (F12) | No red errors | ☐ |
| 3 | **Auth page loads** | Click "Login" or go to /auth | Login form appears | ☐ |
| 4 | **Can create account** | Fill signup form, submit | Success message | ☐ |
| 5 | **Can login** | Use new credentials | Redirects to dashboard | ☐ |

### 🔐 Authentication Check (5 minutes)

| # | Check | Steps | Expected Result | Status |
|---|-------|-------|-----------------|--------|
| 1 | **Signup works** | Enter email + password → Submit | "Check your email" or auto-login | ☐ |
| 2 | **Login works** | Enter credentials → Submit | Redirects to dashboard | ☐ |
| 3 | **Logout works** | Click logout button | Returns to landing page | ☐ |
| 4 | **Protected routes** | Try accessing /dashboard when logged out | Redirects to login | ☐ |

### 📊 Database Check (5 minutes)

| # | Check | How to Test | Expected Result | Status |
|---|-------|-------------|-----------------|--------|
| 1 | **Tables exist** | Supabase Dashboard → Table Editor | 50+ tables visible | ☐ |
| 2 | **User created** | Check `profiles` table | Your user appears | ☐ |
| 3 | **Roles assigned** | Check `user_roles` table | Your role appears | ☐ |
| 4 | **Storage ready** | Supabase → Storage | Buckets exist | ☐ |

### 🤖 AI Features Check (10 minutes)

| # | Check | How to Test | Expected Result | Status |
|---|-------|-------------|-----------------|--------|
| 1 | **Create interview** | Dashboard → Create Interview | Form appears | ☐ |
| 2 | **Generate questions** | Fill form → Generate | Questions generated | ☐ |
| 3 | **Chatbot works** | Click chatbot icon | Chatbot responds | ☐ |

### 🔧 Edge Functions Check

```bash
# Check if functions are deployed
supabase functions list

# Test a specific function
supabase functions invoke test-ai-connection --body '{}'
```

Expected output:
```json
{"success": true, "message": "AI connection working"}
```

### 📧 Email Check (Optional)

| # | Check | How to Test | Expected Result | Status |
|---|-------|-------------|-----------------|--------|
| 1 | **Invite email** | Send interview invitation | Email received | ☐ |
| 2 | **Password reset** | Request password reset | Email received | ☐ |

### 🎉 Success Criteria

**Your deployment is COMPLETE when:**

- ✅ All "Quick Health Check" items pass
- ✅ All "Authentication Check" items pass
- ✅ All "Database Check" items pass
- ✅ At least "Create interview" from AI Features works

**If something fails:**

| Issue | Solution |
|-------|----------|
| Site doesn't load | Check Vercel deployment logs |
| Login fails | Check Supabase URL and anon key |
| Questions don't generate | Check OpenAI API key is set |
| Emails don't send | Set up SMTP or use Supabase email |

---

## 🎊 CONGRATULATIONS!

If you've reached this point with all checks passing, you have successfully:

1. ✅ Set up your development environment
2. ✅ Created your own Supabase project
3. ✅ Deployed the frontend to Vercel
4. ✅ Deployed Edge Functions to Supabase
5. ✅ Configured authentication
6. ✅ Verified everything works

**Your TalentGeenie platform is now LIVE on the internet!**

Share your URL: `https://your-project.vercel.app`

---

## 11. Step 8: Deploy to AWS Amplify (Alternative)

### 10.1 What is AWS Amplify?
Amplify is AWS's easiest way to host a website. It:
- Hosts your app on fast servers worldwide
- Automatically updates when you push code to GitHub
- Provides HTTPS (secure connection) for free
- Gives you a free URL like: `https://main.abc123.amplifyapp.com`

### 10.2 Build Your Project First

Before deploying, we need to create the production files.

**Step 1: Open Terminal in Project Folder**
- In VS Code: Terminal → New Terminal
- Make sure you're in the `ias-platform` folder

**Step 2: Run Build Command**
```bash
npm run build
```

**What You'll See:**
```
> ias-platform@0.0.0 build
> vite build

vite v5.x.x building for production...
✓ 1234 modules transformed.
dist/index.html                     1.23 kB
dist/assets/index-abc123.css       45.67 kB
dist/assets/index-def456.js       890.12 kB
✓ built in 12.34s
```

**What This Creates:**
A new folder called `dist` containing all the files needed for production.

> ❌ **If you see errors:**
> - Try `npm install` first, then `npm run build` again
> - Check for any TypeScript errors in your code

### 10.3 Deploy to Amplify - Step by Step

#### Method A: Connect to GitHub (Recommended - Auto-deploys)

This method automatically deploys whenever you push code to GitHub.

**Step 1: Go to AWS Amplify Console**
1. Open: `console.aws.amazon.com/amplify`
2. Sign in with your IAM user (not root!)
3. Make sure you're in your preferred region (top right dropdown)

**Step 2: Create New App**
1. Click **"Create new app"** (orange button)
2. You'll see "How would you like to deploy?"

**Step 3: Connect GitHub**
1. Click **"GitHub"**
2. Click **"Connect"**
3. A popup appears asking you to authorize AWS
4. Click **"Authorize AWS Amplify"**
5. The popup closes

**Step 4: Select Your Repository**
1. In the "Repository" dropdown, find your fork: `your-username/ias-platform`
2. In the "Branch" dropdown, select `main`
3. Check ☑️ "Connecting a monorepo? Pick a folder" is **UNCHECKED**
4. Click **"Next"**

**Step 5: Configure Build Settings**
1. App name: `ias-platform-production` (or your preference)
2. Under "Build and test settings", click **"Edit"**
3. Replace the content with:

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*
```

4. Click **"Save"**

**Step 6: Add Environment Variables (CRITICAL!)**

This is where you add your secret keys.

1. Scroll down to **"Advanced settings"**
2. Click to expand it
3. Under **"Environment variables"**, click **"Add environment variable"**
4. Add each of these (click "Add" after each one):

| Variable name | Variable value |
|--------------|----------------|
| `VITE_SUPABASE_URL` | `https://YOUR-PROJECT-ID.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...your-anon-key...` |
| `VITE_APP_URL` | (Leave blank for now, we'll update later) |

> ⚠️ Only add the `VITE_` variables here. Secret keys like `OPENAI_API_KEY` go in Supabase, not here!

**Step 7: Review and Deploy**
1. Click **"Next"**
2. Review your settings
3. Click **"Save and deploy"**

**Step 8: Wait for Deployment**
1. You'll see a build pipeline: Provision → Build → Deploy
2. Each step takes a few minutes
3. Total time: 5-15 minutes
4. Wait until all steps show green checkmarks ✓

**Step 9: Get Your URL**
1. Once deployment is complete, look for "Domain"
2. You'll see a URL like: `https://main.d1abc2def3.amplifyapp.com`
3. Click it to see your live site!

#### Method B: Manual Deploy (Drag and Drop)

Use this if you don't want to connect GitHub.

**Step 1: Go to Amplify Console**
1. Open: `console.aws.amazon.com/amplify`
2. Click **"Create new app"**

**Step 2: Choose Manual Deploy**
1. Select **"Deploy without Git provider"**
2. Click **"Continue"**

**Step 3: Configure App**
1. App name: `ias-platform-production`
2. Branch name: `main`
3. Click **"Next"**

**Step 4: Upload Your Build**
1. Under "Method", select **"Drag and drop"**
2. Open your file explorer
3. Navigate to your project folder
4. Find the `dist` folder
5. Drag the entire `dist` folder onto the upload area
6. Wait for upload to complete

**Step 5: Deploy**
1. Click **"Save and deploy"**
2. Wait for deployment to complete
3. Get your URL from the dashboard

### 10.4 Update Your App URL

Now that you have your Amplify URL, update it:

1. In Amplify Console, go to **"Environment variables"**
2. Find `VITE_APP_URL`
3. Update it to your Amplify URL: `https://main.d1abc2def3.amplifyapp.com`
4. Redeploy (Amplify will do this automatically if connected to GitHub)

### 10.5 Deploy Edge Functions to Supabase

Edge Functions are server-side code that handles AI features. They run in Supabase, not Amplify.

**Step 1: Open Terminal in Project Folder**

**Step 2: Deploy All Functions**
```bash
supabase functions deploy
```

You'll see output like:
```
Deploying function: generate-questions
Deploying function: evaluate-interview
Deploying function: analyze-proctoring-video
...
```

**Step 3: Set Secrets for Edge Functions**
```bash
# Set OpenAI API key
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE

# Set service role key (for database access)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ-YOUR-SERVICE-ROLE-KEY
```

**Step 4: Verify Secrets**
```bash
supabase secrets list
```

You should see:
```
OPENAI_API_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### 10.6 What to Do After Every Code Change

**If Using GitHub Connection (Method A):**
1. Make your code changes
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your change description"
   git push origin main
   ```
3. Amplify automatically detects the push and redeploys!

**If Using Manual Deploy (Method B):**
1. Make your code changes
2. Run `npm run build`
3. Go to Amplify Console
4. Click on your app
5. Click **"Redeploy this version"** or drag-drop the new `dist` folder

## 12. Step 9: Configure Environment Variables

### 11.1 Supabase Edge Function Secrets

Go to your Supabase Dashboard:
1. Click **"Edge Functions"** in sidebar
2. Click any function → **"Secrets"**
3. Add these secrets:

| Name | Value |
|------|-------|
| `OPENAI_API_KEY` | sk-proj-... |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... (your service role key) |

Or use CLI:
```bash
supabase secrets set OPENAI_API_KEY=sk-proj-your-key
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJ-your-service-role-key
```

### 11.2 Update Supabase Auth Settings

1. **Go to Authentication Settings**
   - Supabase Dashboard → Authentication → URL Configuration

2. **Add Your Production URL**
   ```
   Site URL: https://your-production-domain.com
   Redirect URLs:
     - https://your-production-domain.com/*
     - https://your-production-domain.com/auth/callback
   ```

3. **Configure Email Templates (Optional)**
   - Go to Authentication → Email Templates
   - Customize confirmation, reset password emails

---

## 13. Step 10: Verify Deployment

### 12.1 Basic Checks

1. **Open your production URL**
   - You should see the landing page

2. **Try to register**
   - Create a new account
   - Verify you receive confirmation email (if enabled)

3. **Login as admin**
   - Use the admin account you created
   - Verify you see admin dashboard

### 12.2 Test Key Features

| Feature | How to Test |
|---------|-------------|
| **Authentication** | Register, login, logout, reset password |
| **Create Interview** | Create a new interview with questions |
| **AI Generation** | Generate questions using AI |
| **Take Interview** | Use share link to take an interview |
| **Proctoring** | Enable proctoring and test camera |
| **Evaluation** | Submit interview and check AI evaluation |

### 12.3 Check Logs

**Supabase Logs:**
- Dashboard → Logs → Edge Functions
- Check for any errors

**Amplify Logs:**
- Amplify Console → Your App → Build logs

---

## 13. Troubleshooting

### Common Issues and Solutions

#### "CORS Error"
**Problem:** Browser blocks requests to Supabase
**Solution:**
1. Go to Supabase Dashboard → Authentication → URL Configuration
2. Add your production URL to "Redirect URLs"

#### "Edge Function Failed"
**Problem:** AI features not working
**Solution:**
1. Check secrets are set: `supabase secrets list`
2. Check function logs in Supabase Dashboard
3. Verify OpenAI API key has credits

#### "Database Connection Failed"
**Problem:** App can't connect to database
**Solution:**
1. Verify `VITE_SUPABASE_URL` is correct
2. Verify `VITE_SUPABASE_ANON_KEY` is correct
3. Check Supabase project is not paused

#### "Build Failed"
**Problem:** Amplify build fails
**Solution:**
1. Check build logs for specific error
2. Verify all environment variables are set
3. Try building locally first: `npm run build`

#### "Authentication Not Working"
**Problem:** Can't login or register
**Solution:**
1. Check Site URL in Supabase Auth settings
2. Verify Redirect URLs include your domain
3. Check if email confirmation is required

### Getting Help

1. **Check Supabase Status:** https://status.supabase.com
2. **Check AWS Status:** https://status.aws.amazon.com
3. **Supabase Discord:** https://discord.supabase.com
4. **AWS Support:** https://console.aws.amazon.com/support

---

## 14. Cost Estimates

### Monthly Costs (Approximate)

#### Minimal Usage (Testing/Demo)
| Service | Cost |
|---------|------|
| Supabase (Free tier) | $0 |
| AWS Amplify (Free tier) | $0 |
| OpenAI API | $5-10 |
| Domain (yearly ÷ 12) | $1 |
| **Total** | **~$6-11/month** |

#### Small Production (100 interviews/month)
| Service | Cost |
|---------|------|
| Supabase Pro | $25 |
| AWS Amplify | $5-15 |
| OpenAI API | $20-50 |
| Domain | $1 |
| **Total** | **~$50-90/month** |

#### Medium Production (1000 interviews/month)
| Service | Cost |
|---------|------|
| Supabase Pro | $25 |
| AWS Amplify | $20-50 |
| OpenAI API | $100-300 |
| Domain | $1 |
| AWS S3 (recordings) | $10-30 |
| **Total** | **~$150-400/month** |

### Free Tier Limits

**Supabase Free:**
- 500 MB database
- 1 GB file storage
- 50,000 monthly active users
- 500,000 Edge Function invocations

**AWS Amplify Free (12 months):**
- 1000 build minutes/month
- 15 GB served/month
- 5 GB stored

**OpenAI:**
- No free tier (pay-as-you-go)
- GPT-4o-mini: ~$0.15 per 1M input tokens

---

## Quick Reference Card

### URLs to Bookmark

| Service | URL |
|---------|-----|
| Your App | https://[your-domain].com |
| Supabase Dashboard | https://supabase.com/dashboard/project/[project-id] |
| AWS Console | https://console.aws.amazon.com |
| Amplify Console | https://console.aws.amazon.com/amplify |
| OpenAI Usage | https://platform.openai.com/usage |

### CLI Commands Cheat Sheet

```bash
# Supabase
supabase login                    # Login to CLI
supabase link --project-ref xxx   # Link to project
supabase db push                  # Push migrations
supabase functions deploy         # Deploy edge functions
supabase secrets set KEY=value    # Set secret
supabase secrets list             # List secrets

# AWS
aws configure                     # Configure credentials
aws sts get-caller-identity       # Verify login

# Project
npm install                       # Install dependencies
npm run build                     # Build for production
npm run dev                       # Run locally
```

### Support Contacts

- **Supabase:** support@supabase.io or Discord
- **AWS:** https://console.aws.amazon.com/support
- **OpenAI:** https://help.openai.com

---

## Appendix A: Complete Credentials Template

Save this as `CREDENTIALS.txt` (KEEP SECRET - never commit to Git!):

```
===========================================
IAS PLATFORM - PRODUCTION CREDENTIALS
Created: [DATE]
===========================================

=== SUPABASE ===
Dashboard: https://supabase.com/dashboard/project/[PROJECT_ID]
Project ID: 
Project URL: https://[PROJECT_ID].supabase.co
Anon Key: 
Service Role Key: [SECRET]
Database Password: [SECRET]
Database URL: postgresql://postgres:[PASSWORD]@db.[PROJECT_ID].supabase.co:5432/postgres

=== AWS ===
Account ID: 
Console: https://[ACCOUNT_ID].signin.aws.amazon.com/console
IAM User: ias-admin
Access Key ID: 
Secret Access Key: [SECRET]
Region: us-east-1

=== OPENAI ===
Dashboard: https://platform.openai.com
API Key: [SECRET]

=== DOMAIN ===
Domain: 
Registrar: 
DNS Provider: 

=== APPLICATION ===
Production URL: 
Admin Email: 
Admin Password: [SECRET]

===========================================
KEEP THIS FILE SECURE!
===========================================
```

---

## Appendix B: Alternative Deployment Options

### Deploy to Vercel (Alternative to AWS)

1. Go to https://vercel.com
2. Sign up with GitHub
3. Click "Import Project"
4. Select your repository
5. Add environment variables
6. Deploy

### Deploy to Netlify (Alternative to AWS)

1. Go to https://netlify.com
2. Sign up with GitHub
3. Click "Add new site" → "Import an existing project"
4. Select your repository
5. Build command: `npm run build`
6. Publish directory: `dist`
7. Add environment variables
8. Deploy

### Self-Hosted on VPS (Advanced)

For a VPS like DigitalOcean, Linode, or AWS EC2:

```bash
# On your server
git clone [your-repo]
cd ias-platform
npm install
npm run build

# Install and configure nginx
sudo apt install nginx
# Add nginx config for your domain

# Use PM2 for process management
npm install -g pm2
pm2 start npm --name "ias" -- run preview
pm2 save
```

---

## PART 2: FULL INDEPENDENCE FROM LOVABLE CLOUD

> **⚠️ ADVANCED SECTION** - This section is for users who want COMPLETE independence from Lovable Cloud, including running their own backend. This requires significant technical work.

---

## 15. Understanding Your Deployment Options

Before proceeding, understand the three paths available:

### Option A: Supabase-Hosted Backend (RECOMMENDED)
```
┌─────────────────────────────────────────────────────────────────┐
│                    OPTION A: SUPABASE-HOSTED                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  YOUR SERVER (Docker/VPS/Cloud)         SUPABASE.COM            │
│  ┌─────────────────────────┐    ┌───────────────────────────┐   │
│  │                         │    │                           │   │
│  │  React Frontend         │───▶│  PostgreSQL Database      │   │
│  │  (Your Control)         │    │  Edge Functions (Deno)    │   │
│  │                         │    │  Auth & Storage           │   │
│  └─────────────────────────┘    │  (Supabase Manages)       │   │
│                                 └───────────────────────────┘   │
│                                                                  │
│  ✅ Edge Functions work as-is (no code changes!)                │
│  ✅ Easy migration - just create new Supabase project           │
│  ✅ Supabase handles backups, scaling, security                 │
│  ⚠️ Still depends on Supabase (but YOUR account)                │
│  💰 Cost: Supabase Free/Pro ($0-25/month) + hosting             │
└─────────────────────────────────────────────────────────────────┘
```

### Option B: Self-Hosted PostgreSQL + Node.js APIs
```
┌─────────────────────────────────────────────────────────────────┐
│                OPTION B: FULLY SELF-HOSTED                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  YOUR SERVER (Docker/VPS/Cloud)                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                                                          │    │
│  │  React Frontend        Node.js API Server               │    │
│  │  (nginx/static)   ──▶  (Express/Fastify)                │    │
│  │                         │                                │    │
│  │                         ▼                                │    │
│  │                   PostgreSQL Database                    │    │
│  │                   (Docker/Managed)                       │    │
│  │                                                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ✅ 100% independence - no external dependencies                │
│  ✅ Full control over all components                            │
│  ⚠️ REQUIRES: Converting 70+ Edge Functions to Node.js         │
│  ⚠️ REQUIRES: Implementing your own Auth system                 │
│  ⚠️ REQUIRES: Managing database backups, security               │
│  💰 Cost: VPS ($5-50/month) + managed DB ($15-100/month)        │
└─────────────────────────────────────────────────────────────────┘
```

### Option C: Self-Hosted Supabase (Docker)
```
┌─────────────────────────────────────────────────────────────────┐
│              OPTION C: SELF-HOSTED SUPABASE                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  YOUR SERVER (VPS with 8GB+ RAM)                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  Supabase Docker Stack (15+ containers)                  │    │
│  │  ┌─────────────┐ ┌────────────┐ ┌──────────────────┐    │    │
│  │  │ PostgreSQL  │ │ GoTrue     │ │ Kong (Gateway)   │    │    │
│  │  │ (Database)  │ │ (Auth)     │ │ Realtime         │    │    │
│  │  └─────────────┘ └────────────┘ │ Storage          │    │    │
│  │  ┌─────────────┐ ┌────────────┐ │ PostgREST        │    │    │
│  │  │ Edge Funcs  │ │ Studio     │ │ ...and more      │    │    │
│  │  │ (Deno)      │ │ (Dashboard)│ └──────────────────┘    │    │
│  │  └─────────────┘ └────────────┘                          │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ✅ Edge Functions work as-is (no code changes!)                │
│  ✅ Full Supabase experience, self-hosted                       │
│  ⚠️ REQUIRES: Powerful server (8GB+ RAM minimum)                │
│  ⚠️ REQUIRES: DevOps expertise for maintenance                  │
│  💰 Cost: Powerful VPS ($40-100+/month)                         │
└─────────────────────────────────────────────────────────────────┘
```

### Decision Matrix

| Factor | Option A (Supabase) | Option B (Node.js) | Option C (Self-Hosted Supabase) |
|--------|--------------------|--------------------|--------------------------------|
| **Difficulty** | Easy | Very Hard | Hard |
| **Time to Deploy** | 1-2 hours | 2-4 weeks | 1-2 days |
| **Code Changes** | None | Massive (70+ functions) | None |
| **Monthly Cost** | $25-50 | $20-100 | $40-100 |
| **Control Level** | Medium | Full | High |
| **Maintenance** | Low | High | Medium |
| **Best For** | Most users | Large enterprises | Tech teams |

---

## 16. OPTION A: Deploy to Your Own Supabase Account (RECOMMENDED)

This is the **easiest path** - Edge Functions work without changes!

### 16.1 Create Your Own Supabase Project

Follow Section 4 of this guide to create a new Supabase project on supabase.com.

### 16.2 Export Data from Lovable Cloud

**Step 1: Get your current Lovable Cloud credentials**
- Your project is connected to: `vtztavcqjmirktkjdprm.supabase.co`
- You'll need access to export the schema and data

**Step 2: Export the database schema**
The schema is already available in `supabase/migrations/` folder. This contains all table definitions, functions, triggers, and RLS policies.

### 16.3 Import Schema to Your New Project

```bash
# Link to your NEW Supabase project (not Lovable Cloud)
supabase link --project-ref YOUR_NEW_PROJECT_ID

# Push all migrations
supabase db push

# Deploy Edge Functions
supabase functions deploy
```

### 16.4 Set Edge Function Secrets

```bash
# Set your AI API keys
supabase secrets set OPENAI_API_KEY=sk-your-key
supabase secrets set GOOGLE_GEMINI_API_KEY=your-gemini-key

# Set email configuration (if using SMTP)
supabase secrets set SMTP_HOST=smtp.example.com
supabase secrets set SMTP_USER=your-email
supabase secrets set SMTP_PASS=your-password
```

### 16.5 Update Frontend Environment Variables

Create `.env.production`:
```bash
VITE_SUPABASE_URL=https://YOUR_NEW_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_new_anon_key
```

### 16.6 Build and Deploy Frontend

```bash
npm run build
# Deploy dist/ folder to your hosting (Vercel, Netlify, AWS, etc.)
```

**That's it!** Your app now runs on YOUR Supabase account.

---

## 17. OPTION B: Convert Edge Functions to Node.js (Full Independence)

> **⚠️ WARNING: This is a MAJOR undertaking!** You have 70+ Edge Functions that need conversion. Estimated time: 2-4 weeks for a experienced developer.

### 17.1 Understanding What Needs to Change

**Edge Functions (Deno)** vs **Node.js APIs**:

| Aspect | Supabase Edge Functions | Node.js Express API |
|--------|------------------------|---------------------|
| Runtime | Deno (TypeScript) | Node.js |
| Imports | URL imports (esm.sh) | npm packages |
| HTTP | Deno.serve() | Express/Fastify |
| Database | Supabase client | pg/postgres package |
| Auth | Built-in via headers | Custom JWT handling |
| Environment | Deno.env.get() | process.env |

### 17.2 Set Up Node.js API Server

**Step 1: Create API project structure**

```bash
mkdir talentgeenie-api
cd talentgeenie-api
npm init -y
```

**Step 2: Install dependencies**

```bash
npm install express cors helmet dotenv pg jsonwebtoken zod openai @google/generative-ai bcryptjs nodemailer uuid
npm install -D typescript @types/express @types/node @types/cors @types/jsonwebtoken @types/bcryptjs @types/nodemailer @types/uuid ts-node nodemon
```

**Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 4: Create project structure**

```
talentgeenie-api/
├── src/
│   ├── index.ts              # Main server entry
│   ├── config/
│   │   ├── database.ts       # PostgreSQL connection
│   │   └── env.ts            # Environment variables
│   ├── middleware/
│   │   ├── auth.ts           # JWT authentication
│   │   ├── cors.ts           # CORS handling
│   │   └── errorHandler.ts   # Error handling
│   ├── routes/
│   │   ├── interviews.ts     # Interview endpoints
│   │   ├── questions.ts      # Question generation
│   │   ├── auth.ts           # Authentication
│   │   └── ... (one per edge function)
│   ├── services/
│   │   ├── ai.ts             # OpenAI/Gemini integration
│   │   ├── email.ts          # Email sending
│   │   └── proctoring.ts     # Proctoring logic
│   └── utils/
│       ├── validators.ts     # Zod schemas
│       └── helpers.ts        # Utility functions
├── package.json
├── tsconfig.json
├── Dockerfile
└── .env.example
```

### 17.3 Convert Edge Function Pattern

Here's how to convert each Edge Function:

**BEFORE: Supabase Edge Function (Deno)**
```typescript
// supabase/functions/generate-questions/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  const { interviewId, jobDescription } = await req.json();
  
  // ... logic ...
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
});
```

**AFTER: Node.js Express Route**
```typescript
// src/routes/questions.ts
import { Router, Request, Response, NextFunction } from 'express';
import { Pool } from 'pg';
import { z } from 'zod';
import { authenticateRequest } from '../middleware/auth';
import { generateQuestionsWithAI } from '../services/ai';

const router = Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const GenerateQuestionsSchema = z.object({
  interviewId: z.string().uuid(),
  jobDescription: z.string().min(1),
  questionCount: z.number().int().positive().optional().default(10),
});

router.post('/generate', authenticateRequest, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validated = GenerateQuestionsSchema.parse(req.body);
    const { interviewId, jobDescription, questionCount } = validated;
    
    // Verify interview exists and user has access
    const interviewResult = await pool.query(
      'SELECT * FROM interviews WHERE id = $1 AND creator_id = $2',
      [interviewId, req.user.id]
    );
    
    if (interviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Interview not found' });
    }
    
    // Generate questions using AI service
    const questions = await generateQuestionsWithAI(jobDescription, questionCount);
    
    // Insert questions into database
    for (const q of questions) {
      await pool.query(
        `INSERT INTO questions (interview_id, question_text, topic, difficulty, question_type, options, correct_answer)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [interviewId, q.question_text, q.topic, q.difficulty, q.question_type, 
         JSON.stringify(q.options), q.correct_answer]
      );
    }
    
    res.json({ success: true, questionsGenerated: questions.length });
  } catch (error) {
    next(error);
  }
});

export default router;
```

### 17.4 Complete Edge Function Conversion List

Here are ALL 70+ functions that need conversion:

#### **AI/Generation Functions (HIGH PRIORITY)**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `generate-questions` | Critical | High | AI prompt + batch processing |
| `evaluate-interview` | Critical | High | AI evaluation + scoring |
| `evaluate-certification` | Critical | High | Similar to evaluate-interview |
| `evaluate-learning-assessment` | Critical | High | Similar pattern |
| `generate-certification-questions` | Critical | High | Similar to generate-questions |
| `generate-learning-questions` | Critical | High | Similar pattern |
| `chatbot-assist` | High | Medium | AI chat integration |
| `detect-bias` | Medium | Medium | AI analysis |
| `parse-resume` | Medium | Medium | AI extraction |
| `extract-skills` | Medium | Medium | AI analysis |
| `generate-job-description` | Medium | Medium | AI generation |
| `generate-training-plan` | Low | Medium | AI generation |
| `generate-comparative-report` | Low | High | Complex AI report |
| `generate-predictive-analytics` | Low | High | Complex AI analysis |

#### **Authentication/User Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `admin-user-management` | Critical | Medium | User CRUD |
| `complete-user-signup` | Critical | Medium | User registration flow |
| `complete-password-setup` | Critical | Medium | Password handling |
| `send-password-setup` | Critical | Low | Email trigger |
| `manage-organization-user` | High | Medium | Org membership |
| `approve-partner-application` | Medium | Medium | Approval workflow |

#### **Interview Management Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `delete-interview` | Critical | Low | Cascade delete |
| `send-interview-invitations` | Critical | Medium | Email + invitation logic |
| `resolve-invitation` | Critical | Medium | Invitation token handling |
| `resolve-slug-invitation` | High | Medium | Slug-based lookup |
| `schedule-interview` | Medium | Low | Date handling |
| `add-questions` | High | Low | Question CRUD |
| `approve-questions` | Medium | Low | Status update |
| `bulk-approve-questions` | Medium | Low | Batch update |
| `regenerate-questions` | High | Medium | AI regeneration |
| `regenerate-single-question` | Medium | Medium | Single AI call |
| `get-approved-questions` | Medium | Low | Query |
| `create-from-template` | Medium | Medium | Template cloning |

#### **Proctoring Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `init-proctoring-session` | Critical | Medium | Session setup |
| `update-proctoring-session` | Critical | Low | Session updates |
| `log-proctoring-violation` | Critical | Low | Violation logging |
| `analyze-proctoring-video` | High | High | Video AI analysis |
| `analyze-violations` | Medium | Medium | Violation analysis |
| `upload-proctoring-recording` | Critical | Medium | File upload handling |
| `upload-proctoring-screenshot` | High | Medium | Screenshot handling |

#### **Email Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `send-email` | Critical | Low | SMTP sending |
| `resend-email` | Medium | Low | Retry logic |
| `send-notification` | High | Low | Notification emails |
| `send-review-request` | Medium | Low | Email template |
| `enhance-email-content` | Low | Medium | AI enhancement |

#### **Billing/Payment Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `generate-invoice` | Medium | Medium | Invoice generation |
| `check-assessment-limit` | Medium | Low | Limit checking |

#### **Testing/Admin Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `seed-test-data` | Low | Medium | Test data seeding |
| `seed-flow-data` | Low | Medium | Flow data seeding |
| `cleanup-test-data` | Low | Low | Data cleanup |
| `cleanup-all-except-admins` | Low | Low | Admin cleanup |
| `validate-test-data` | Low | Low | Validation |
| `run-tests` | Low | Medium | Test runner |
| `run-flow-tests` | Low | Medium | Flow tests |
| `run-comprehensive-flow-test` | Low | High | Full test suite |
| `analyze-test-error` | Low | Medium | Error analysis |
| `auto-fix-issue` | Low | High | Auto-fix logic |

#### **System/Utility Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `test-ai-connection` | Medium | Low | Health check |
| `test-configuration` | Medium | Low | Config validation |
| `ai-health-monitor` | Medium | Medium | Monitoring |
| `update-ai-feature-model` | Low | Low | Config update |
| `calculate-cpi` | High | Medium | Score calculation |
| `scan-ai-features` | Low | Low | Feature scan |
| `scan-platform-features` | Low | Low | Platform scan |
| `auto-evaluate-trigger` | High | Medium | Auto-trigger |
| `auto-close-sessions` | Medium | Low | Session cleanup |
| `cleanup-stuck-generations` | Low | Low | Cleanup job |
| `scheduled-data-cleanup` | Low | Low | Scheduled job |

#### **Documentation Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `generate-documentation` | Low | Medium | Doc generation |
| `generate-documentation-from-code` | Low | High | Code analysis |
| `generate-architecture-docs` | Low | High | Architecture docs |
| `improve-documentation-format` | Low | Medium | Doc formatting |
| `generate-schema` | Low | Medium | Schema generation |
| `check-file-changes` | Low | Low | File monitoring |

#### **ATS/Integration Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `ats-webhook` | Medium | Medium | Webhook handler |
| `sync-ats-candidates` | Medium | Medium | ATS sync |

#### **Certificate Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `generate-certificate-pdf` | Medium | High | PDF generation |

#### **Organization Functions**
| Edge Function | Priority | Complexity | Notes |
|--------------|----------|------------|-------|
| `delete-organization` | Medium | Medium | Cascade delete |
| `submit-for-review` | Medium | Low | Status update |

### 17.5 Create Main Server Entry Point

```typescript
// src/index.ts
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import { errorHandler } from './middleware/errorHandler';

// Routes
import authRoutes from './routes/auth';
import interviewRoutes from './routes/interviews';
import questionRoutes from './routes/questions';
import proctoringRoutes from './routes/proctoring';
import emailRoutes from './routes/email';
// ... import all other routes

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Database connection
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes - mount each converted edge function
app.use('/api/auth', authRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/proctoring', proctoringRoutes);
app.use('/api/email', emailRoutes);
// ... mount all other routes

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`TalentGeenie API server running on port ${PORT}`);
});
```

### 17.6 Create Authentication Middleware

Since you're leaving Supabase Auth, you need custom JWT handling:

```typescript
// src/middleware/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../index';

interface JWTPayload {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export async function authenticateRequest(
  req: Request, 
  res: Response, 
  next: NextFunction
) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }
    
    const token = authHeader.substring(7);
    
    // Verify JWT
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
    
    // Verify user exists in database
    const result = await pool.query(
      'SELECT id, email FROM profiles WHERE id = $1',
      [decoded.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Get user roles
    const rolesResult = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1',
      [decoded.userId]
    );
    
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      role: rolesResult.rows[0]?.role || 'guest'
    };
    
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Role-based authorization
export function requireRole(...allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}
```

### 17.7 Create AI Service

```typescript
// src/services/ai.ts
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const gemini = process.env.GOOGLE_GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GOOGLE_GEMINI_API_KEY)
  : null;

interface AICallOptions {
  prompt: string;
  systemPrompt?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export async function callAI(options: AICallOptions): Promise<string> {
  const { prompt, systemPrompt, model, temperature = 0.7, maxTokens = 4096 } = options;
  
  // Try OpenAI first
  if (openai) {
    try {
      const response = await openai.chat.completions.create({
        model: model || 'gpt-4o-mini',
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt }
        ],
        temperature,
        max_tokens: maxTokens
      });
      
      return response.choices[0]?.message?.content || '';
    } catch (error) {
      console.error('OpenAI call failed:', error);
      // Fall through to Gemini
    }
  }
  
  // Fallback to Gemini
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const result = await model.generateContent(
        systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt
      );
      return result.response.text();
    } catch (error) {
      console.error('Gemini call failed:', error);
      throw error;
    }
  }
  
  throw new Error('No AI provider configured');
}

export async function generateQuestionsWithAI(
  jobDescription: string, 
  count: number
): Promise<any[]> {
  const prompt = `Generate ${count} interview questions for this job:
  
${jobDescription}

Return as JSON array: [{"question_text": "...", "topic": "...", "difficulty": "easy|medium|hard", "question_type": "mcq|descriptive|coding|scenario", "options": [...], "correct_answer": "..."}]`;

  const response = await callAI({ prompt });
  
  // Parse JSON from response
  const jsonMatch = response.match(/\[[\s\S]*\]/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response as JSON');
  }
  
  return JSON.parse(jsonMatch[0]);
}
```

### 17.8 Update Frontend to Call Node.js API

**BEFORE (calling Supabase Edge Functions):**
```typescript
const { data, error } = await supabase.functions.invoke('generate-questions', {
  body: { interviewId, jobDescription }
});
```

**AFTER (calling Node.js API):**
```typescript
const response = await fetch(`${import.meta.env.VITE_API_URL}/api/questions/generate`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`
  },
  body: JSON.stringify({ interviewId, jobDescription })
});
const data = await response.json();
```

You'll need to update **every file** that calls `supabase.functions.invoke()`. Search your codebase:

```bash
grep -r "functions.invoke" src/
```

### 17.9 Docker Compose for Full Stack

```yaml
# docker-compose.fullstack.yml
version: '3.8'

services:
  # PostgreSQL Database
  db:
    image: postgres:15-alpine
    container_name: talentgeenie-db
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER:-postgres}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME:-talentgeenie}
    volumes:
      - postgres-data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d:ro
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Node.js API Server
  api:
    build:
      context: ./talentgeenie-api
      dockerfile: Dockerfile
    container_name: talentgeenie-api
    restart: always
    environment:
      DATABASE_URL: postgresql://${DB_USER:-postgres}:${DB_PASSWORD}@db:5432/${DB_NAME:-talentgeenie}
      JWT_SECRET: ${JWT_SECRET}
      OPENAI_API_KEY: ${OPENAI_API_KEY}
      GOOGLE_GEMINI_API_KEY: ${GOOGLE_GEMINI_API_KEY}
      SMTP_HOST: ${SMTP_HOST}
      SMTP_USER: ${SMTP_USER}
      SMTP_PASS: ${SMTP_PASS}
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost:8080}
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  # React Frontend
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_API_URL: ${API_URL:-http://localhost:3000}
    container_name: talentgeenie-frontend
    restart: always
    ports:
      - "8080:8080"
    depends_on:
      - api

volumes:
  postgres-data:
```

### 17.10 API Dockerfile

```dockerfile
# talentgeenie-api/Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

EXPOSE 3000

CMD ["node", "dist/index.js"]
```

---

## 18. OPTION C: Self-Hosted Supabase (Docker)

If you want to run the full Supabase stack on your own server:

### 18.1 Prerequisites
- VPS with minimum 8GB RAM (16GB recommended)
- Docker and Docker Compose installed
- Domain name with DNS configured

### 18.2 Clone Supabase Docker

```bash
# Get Supabase Docker setup
git clone --depth 1 https://github.com/supabase/supabase
cd supabase/docker

# Copy example env file
cp .env.example .env
```

### 18.3 Configure Environment

Edit `.env` with your values:
```bash
# Generate secure secrets
openssl rand -base64 32  # For JWT_SECRET
openssl rand -base64 32  # For ANON_KEY
openssl rand -base64 32  # For SERVICE_ROLE_KEY

# Edit .env
nano .env
```

Key variables to set:
```
POSTGRES_PASSWORD=your-secure-password
JWT_SECRET=your-jwt-secret
ANON_KEY=your-anon-key
SERVICE_ROLE_KEY=your-service-role-key
SITE_URL=https://yourdomain.com
API_EXTERNAL_URL=https://api.yourdomain.com
```

### 18.4 Start Supabase

```bash
docker compose up -d
```

### 18.5 Apply Migrations

```bash
# Copy your migrations
cp -r /path/to/talentgeenie/supabase/migrations/* ./volumes/db/migrations/

# Restart to apply
docker compose restart db
```

### 18.6 Deploy Edge Functions

Self-hosted Supabase supports Edge Functions:

```bash
# Link to your self-hosted instance
supabase link --project-ref local

# Deploy functions
supabase functions deploy
```

---

## 19. Migration Checklist

Use this checklist to track your migration progress:

### Pre-Migration
- [ ] Backup all data from Lovable Cloud
- [ ] Document all environment variables
- [ ] List all Edge Functions being used
- [ ] Choose deployment option (A, B, or C)
- [ ] Set up target infrastructure

### Database Migration
- [ ] Create new database (Supabase/PostgreSQL)
- [ ] Apply all migrations from `supabase/migrations/`
- [ ] Verify all tables created correctly
- [ ] Verify all functions and triggers
- [ ] Verify all RLS policies
- [ ] Import existing data (if needed)

### Backend Migration (Option B only)
- [ ] Set up Node.js API project
- [ ] Convert critical Edge Functions first:
  - [ ] generate-questions
  - [ ] evaluate-interview
  - [ ] send-email
  - [ ] Authentication functions
- [ ] Convert remaining functions by priority
- [ ] Test each converted function
- [ ] Update frontend API calls

### Frontend Migration
- [ ] Update environment variables
- [ ] Update API endpoints (if using Option B)
- [ ] Build production bundle
- [ ] Deploy to hosting

### Post-Migration
- [ ] Verify all features working
- [ ] Test authentication flow
- [ ] Test interview creation
- [ ] Test question generation
- [ ] Test evaluation
- [ ] Test email sending
- [ ] Set up monitoring
- [ ] Set up backups
- [ ] Document new deployment

---

## 20. Troubleshooting Full Independence

### "Database connection failed"
```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check connection string
psql "postgresql://user:pass@host:5432/db"

# Check network connectivity
telnet your-db-host 5432
```

### "AI features not working"
```bash
# Verify API keys are set
echo $OPENAI_API_KEY
echo $GOOGLE_GEMINI_API_KEY

# Test AI connection
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

### "Authentication not working"
```bash
# Check JWT secret matches
# Frontend and backend must use same secret

# Verify token format
jwt decode your-token
```

### "CORS errors"
```typescript
// Ensure CORS is configured correctly
app.use(cors({
  origin: ['https://yourdomain.com', 'http://localhost:5173'],
  credentials: true
}));
```

---

# PART 5: ARCHITECTURE, SECURITY & LONG-TERM PLANNING

> **What This Section Covers**: Now that you know HOW to deploy, this section teaches you how to do it SAFELY and SUSTAINABLY for years to come.

---

## 21. Explicit Architectural Boundaries

> **🎯 What Are "Architectural Boundaries"?**
> 
> Think of your application like a house. The "boundaries" are the walls between rooms. Good boundaries mean:
> - If your kitchen catches fire, it doesn't burn down the bedroom
> - If you want to renovate the bathroom, you don't need to rebuild the living room
> 
> In software, this means keeping different parts of your app SEPARATE so they can be changed, upgraded, or fixed independently.

### 21.1 The Three Main "Rooms" of TalentGeenie

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    YOUR APPLICATION'S "HOUSE"                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┐  ┌─────────────────────┐  ┌─────────────────────┐  │
│  │                     │  │                     │  │                     │  │
│  │     FRONTEND        │  │      BACKEND        │  │     DATABASE        │  │
│  │     (React)         │  │   (Edge Functions)  │  │    (PostgreSQL)     │  │
│  │                     │  │                     │  │                     │  │
│  │  What users SEE     │  │  Business LOGIC     │  │  Where data LIVES   │  │
│  │  and CLICK          │  │  and AI processing  │  │  permanently        │  │
│  │                     │  │                     │  │                     │  │
│  │  📁 src/ folder     │  │  📁 supabase/       │  │  📁 migrations/     │  │
│  │                     │  │     functions/      │  │                     │  │
│  └─────────────────────┘  └─────────────────────┘  └─────────────────────┘  │
│           │                        │                        │               │
│           │                        │                        │               │
│           ▼                        ▼                        ▼               │
│     Can be hosted             Can be hosted            Can be hosted        │
│     ANYWHERE                  ANYWHERE                 ANYWHERE             │
│     (Vercel, etc)             (AWS, etc)               (Any PostgreSQL)     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 21.2 Why Boundaries Matter (Real Examples)

#### Example 1: Upgrading React Version
```
WITHOUT Good Boundaries (❌ BAD):
  - Change React version
  - Backend breaks
  - Database queries fail
  - Everything stops working
  - You spend 3 days fixing

WITH Good Boundaries (✅ GOOD):
  - Change React version
  - Frontend updates
  - Backend doesn't notice
  - Database doesn't notice
  - Done in 30 minutes
```

#### Example 2: Switching AI Providers
```
WITHOUT Good Boundaries (❌ BAD):
  - AI provider changes API
  - You edit 70 files
  - Frontend code has OpenAI calls mixed in
  - Database has API keys hardcoded
  - Takes 2 weeks to fix

WITH Good Boundaries (✅ GOOD):
  - AI provider changes API
  - You edit 1 file (ai-caller.ts)
  - Frontend doesn't know/care
  - Database unchanged
  - Done in 1 hour
```

### 21.3 TalentGeenie's Boundary Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        BOUNDARY LAYER DIAGRAM                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│    USER'S BROWSER                                                           │
│         │                                                                   │
│         ▼                                                                   │
│    ┌─────────────────────────────────────────────────────────────┐         │
│    │                  LAYER 1: PRESENTATION                       │         │
│    │                                                              │         │
│    │   📁 src/pages/           - What users see                  │         │
│    │   📁 src/components/      - Reusable UI parts               │         │
│    │   📁 src/components/ui/   - Design system (buttons, etc)    │         │
│    │                                                              │         │
│    │   RULE: NO business logic here, just display                │         │
│    │   RULE: NO direct database calls                            │         │
│    └─────────────────────────────────────────────────────────────┘         │
│         │                                                                   │
│         │ ← Only talks through hooks and API calls                         │
│         ▼                                                                   │
│    ┌─────────────────────────────────────────────────────────────┐         │
│    │                  LAYER 2: APPLICATION                        │         │
│    │                                                              │         │
│    │   📁 src/hooks/           - Data fetching logic             │         │
│    │   📁 src/contexts/        - Shared state (auth, etc)        │         │
│    │   📁 src/lib/             - Utility functions               │         │
│    │                                                              │         │
│    │   RULE: Connects UI to backend                              │         │
│    │   RULE: Handles caching and state                           │         │
│    └─────────────────────────────────────────────────────────────┘         │
│         │                                                                   │
│         │ ← Only talks through Supabase client                             │
│         ▼                                                                   │
│    ┌─────────────────────────────────────────────────────────────┐         │
│    │                  LAYER 3: API / EDGE FUNCTIONS               │         │
│    │                                                              │         │
│    │   📁 supabase/functions/              - 70+ functions       │         │
│    │   📁 supabase/functions/_shared/      - Shared utilities    │         │
│    │                                                              │         │
│    │   RULE: All AI calls go through here                        │         │
│    │   RULE: All external API calls go through here              │         │
│    │   RULE: Never exposes secrets to frontend                   │         │
│    └─────────────────────────────────────────────────────────────┘         │
│         │                                                                   │
│         │ ← Only talks through Supabase SDK                                │
│         ▼                                                                   │
│    ┌─────────────────────────────────────────────────────────────┐         │
│    │                  LAYER 4: DATABASE                           │         │
│    │                                                              │         │
│    │   📁 supabase/migrations/      - Schema definitions         │         │
│    │   Tables, RLS policies, functions, triggers                 │         │
│    │                                                              │         │
│    │   RULE: Data validation happens here (final check)          │         │
│    │   RULE: RLS policies enforce security                       │         │
│    │   RULE: Never trust frontend data                           │         │
│    └─────────────────────────────────────────────────────────────┘         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 21.4 Boundary Rules (Simple Version)

| Layer | Can Talk To | Cannot Talk To | Why |
|-------|-------------|----------------|-----|
| **Pages** | Hooks, Components | Database directly | UI shouldn't know about DB structure |
| **Hooks** | Supabase client, Edge Functions | External APIs directly | Keeps API keys safe |
| **Edge Functions** | Database, External APIs | Nothing (they respond) | They ARE the API |
| **Database** | Nothing (stores data) | External services | Security and reliability |

### 21.5 How to Check If You're Breaking Boundaries

**🔍 Quick Self-Check Checklist:**

```
□ Do any files in src/pages/ contain "fetch()" to external APIs?
  → If YES: Move that logic to an Edge Function

□ Do any files in src/components/ access localStorage for user data?
  → If YES: Move to a Context or Hook

□ Do any Edge Functions have hardcoded database connection strings?
  → If YES: Use environment variables

□ Are there any API keys in files inside src/ folder?
  → If YES: CRITICAL! Move to Edge Functions immediately
```

**🛠️ Command to Find Boundary Violations:**

```bash
# 🍎 Mac / 🪟 Windows (Git Bash):

# Find any direct API calls in components (potential violation)
grep -r "fetch\(" src/pages/ src/components/ | grep -v "node_modules"

# Find any hardcoded API keys (CRITICAL violation)
grep -r "sk-\|api_key\|apiKey" src/ | grep -v "node_modules"

# Find direct Supabase table access in pages (should use hooks)
grep -r "supabase.from\(" src/pages/ | grep -v "node_modules"
```

### 21.6 Making Changes Safely (Boundary-Aware)

**When you want to change something, ask yourself:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     CHANGE DECISION FLOWCHART                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   "I want to change ____________"                                           │
│                 │                                                           │
│                 ▼                                                           │
│        Is it about HOW                                                      │
│        things LOOK?                                                         │
│        (colors, layout,                                                     │
│        text, animations)                                                    │
│              │                                                              │
│         YES  │  NO                                                          │
│              │  │                                                           │
│              ▼  ▼                                                           │
│   ┌─────────────┐  Is it about HOW                                         │
│   │ Edit files  │  data is PROCESSED?                                      │
│   │ in src/     │  (calculations, AI,                                      │
│   │ only        │  business rules)                                         │
│   │             │       │                                                   │
│   │ ✅ Safe to  │  YES  │  NO                                               │
│   │ change      │       │  │                                                │
│   └─────────────┘       ▼  ▼                                                │
│                   ┌─────────────┐  Is it about HOW                         │
│                   │ Edit Edge   │  data is STORED?                         │
│                   │ Functions   │  (new columns, tables,                   │
│                   │ only        │  relationships)                          │
│                   │             │       │                                   │
│                   │ ⚠️ Test     │  YES  │                                   │
│                   │ thoroughly  │       │                                   │
│                   └─────────────┘       ▼                                   │
│                                   ┌─────────────┐                          │
│                                   │ Create a    │                          │
│                                   │ MIGRATION   │                          │
│                                   │             │                          │
│                                   │ ⚠️ Test on  │                          │
│                                   │ backup      │                          │
│                                   │ first!      │                          │
│                                   └─────────────┘                          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 22. Security Hardening Guidance

> **🔐 What is "Security Hardening"?**
> 
> Imagine your application is a house again. You've built it, but now you need to:
> - Lock the doors
> - Install a security system
> - Put bars on ground-floor windows
> - Hide your valuables in a safe
> 
> "Hardening" is making your application tough for attackers to break into.

### 22.1 Security Threat Map (What We're Protecting Against)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THREAT LANDSCAPE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   EXTERNAL THREATS                          INTERNAL RISKS                  │
│   ─────────────────                         ───────────────                  │
│                                                                              │
│   🦹 Hackers                                👤 Accidental exposure          │
│      └── Want your data                        └── Committing API keys      │
│      └── Want to steal credentials                 to GitHub                │
│      └── Want to deface your site                                           │
│                                             🔧 Misconfiguration             │
│   🤖 Bots                                      └── Public database tables   │
│      └── Brute force login attempts            └── Weak passwords           │
│      └── Scraping data                         └── Missing RLS policies     │
│      └── DDoS attacks                                                       │
│                                             📧 Social engineering           │
│   🕵️ Competitors                               └── Phishing for admin       │
│      └── Stealing candidate data                   credentials              │
│      └── Copying your platform                                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 22.2 Security Checklist (Step-by-Step)

#### Level 1: CRITICAL (Do This TODAY)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🔴 CRITICAL SECURITY - Without these, you WILL get hacked                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  □ 1. NO API KEYS IN CODE                                                   │
│                                                                              │
│     ❌ WRONG (will get stolen):                                             │
│     ```javascript                                                           │
│     const apiKey = "sk-1234567890abcdef";  // NEVER DO THIS!               │
│     ```                                                                     │
│                                                                              │
│     ✅ RIGHT (safe):                                                        │
│     ```javascript                                                           │
│     const apiKey = Deno.env.get("OPENAI_API_KEY");  // In Edge Function    │
│     ```                                                                     │
│                                                                              │
│     📍 HOW TO CHECK:                                                        │
│     ```bash                                                                 │
│     # Run this command - if it finds anything, you have a problem          │
│     grep -r "sk-" src/ --include="*.ts" --include="*.tsx"                  │
│     grep -r "apiKey\s*=" src/ --include="*.ts" --include="*.tsx"           │
│     ```                                                                     │
│                                                                              │
│  □ 2. RLS (Row Level Security) ENABLED ON ALL TABLES                        │
│                                                                              │
│     📍 HOW TO CHECK (in Supabase):                                          │
│     ```sql                                                                  │
│     -- Run this query - any table showing 'f' is VULNERABLE                │
│     SELECT tablename, rowsecurity                                           │
│     FROM pg_tables                                                          │
│     WHERE schemaname = 'public';                                            │
│     ```                                                                     │
│                                                                              │
│     📍 HOW TO FIX:                                                          │
│     ```sql                                                                  │
│     -- For each table missing RLS:                                          │
│     ALTER TABLE your_table_name ENABLE ROW LEVEL SECURITY;                  │
│                                                                              │
│     -- Then add a policy (example for user-owned data):                     │
│     CREATE POLICY "Users can view own data"                                 │
│       ON your_table_name FOR SELECT                                         │
│       USING (auth.uid() = user_id);                                         │
│     ```                                                                     │
│                                                                              │
│  □ 3. HTTPS EVERYWHERE (No HTTP)                                            │
│                                                                              │
│     📍 HOW TO CHECK:                                                        │
│     - Open your site in browser                                             │
│     - Look at address bar                                                   │
│     - Should show 🔒 and "https://"                                        │
│     - If it shows "Not Secure" - STOP and fix this first                   │
│                                                                              │
│     📍 HOW TO FIX:                                                          │
│     - Vercel/Netlify: Automatic (already done)                              │
│     - Docker/Self-hosted: Need SSL certificate (use Let's Encrypt)         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Level 2: IMPORTANT (Do This Week)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🟠 IMPORTANT SECURITY - Significantly reduces risk                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  □ 4. STRONG PASSWORD REQUIREMENTS                                          │
│                                                                              │
│     Already configured in: src/lib/validations.ts                           │
│     Requirements: 8+ chars, uppercase, lowercase, number, special char     │
│                                                                              │
│     📍 HOW TO VERIFY:                                                       │
│     - Try creating an account with password "123456"                        │
│     - Should be REJECTED                                                    │
│                                                                              │
│  □ 5. RATE LIMITING ON LOGIN                                                │
│                                                                              │
│     Prevents: Attackers trying millions of password guesses                 │
│                                                                              │
│     📍 For Supabase (already built-in):                                     │
│     - Supabase has automatic rate limiting                                  │
│     - Default: 100 requests per minute per IP                               │
│                                                                              │
│     📍 For Self-hosted Node.js, add to your API:                            │
│     ```javascript                                                           │
│     import rateLimit from 'express-rate-limit';                             │
│                                                                              │
│     const loginLimiter = rateLimit({                                        │
│       windowMs: 15 * 60 * 1000, // 15 minutes                               │
│       max: 5, // 5 attempts per window                                      │
│       message: 'Too many login attempts. Try again in 15 minutes.'          │
│     });                                                                     │
│                                                                              │
│     app.post('/auth/login', loginLimiter, loginHandler);                    │
│     ```                                                                     │
│                                                                              │
│  □ 6. INPUT VALIDATION (Never Trust User Input)                             │
│                                                                              │
│     ❌ WRONG:                                                                │
│     ```javascript                                                           │
│     // Taking user input directly - SQL injection risk!                     │
│     const query = `SELECT * FROM users WHERE name = '${userInput}'`;        │
│     ```                                                                     │
│                                                                              │
│     ✅ RIGHT (Supabase SDK does this automatically):                        │
│     ```javascript                                                           │
│     // Parameterized query - safe                                           │
│     const { data } = await supabase                                         │
│       .from('users')                                                        │
│       .select('*')                                                          │
│       .eq('name', userInput);  // Supabase escapes this for you            │
│     ```                                                                     │
│                                                                              │
│  □ 7. CORS CONFIGURATION                                                    │
│                                                                              │
│     What is CORS? It controls which websites can call your API.             │
│                                                                              │
│     📍 For Edge Functions (in supabase/functions/_shared/cors.ts):          │
│     ```typescript                                                           │
│     export const corsHeaders = {                                            │
│       'Access-Control-Allow-Origin': 'https://yourdomain.com', // Specific!│
│       'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',            │
│       'Access-Control-Allow-Headers': 'authorization, content-type',        │
│     };                                                                      │
│                                                                              │
│     // ❌ AVOID in production:                                               │
│     // 'Access-Control-Allow-Origin': '*'  // Allows ANY website!          │
│     ```                                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Level 3: RECOMMENDED (Do This Month)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🟡 RECOMMENDED SECURITY - Best practices for production                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  □ 8. AUDIT LOGGING                                                         │
│                                                                              │
│     Already implemented in: src/lib/audit-logger.ts                         │
│     Tracks: Who did what, when, from where                                  │
│                                                                              │
│     📍 HOW TO VERIFY:                                                       │
│     ```sql                                                                  │
│     -- Check audit logs are being recorded                                  │
│     SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;            │
│     ```                                                                     │
│                                                                              │
│  □ 9. DATA ENCRYPTION AT REST                                               │
│                                                                              │
│     What: Data is encrypted when stored on disk                             │
│                                                                              │
│     📍 Supabase: Automatic (already encrypted)                              │
│     📍 Self-hosted PostgreSQL:                                              │
│     ```bash                                                                 │
│     # Check if encryption is enabled                                        │
│     SHOW data_encryption;                                                   │
│                                                                              │
│     # For AWS RDS: Enable encryption when creating instance                 │
│     # For Docker: Use encrypted volumes                                     │
│     ```                                                                     │
│                                                                              │
│  □ 10. BACKUP ENCRYPTION                                                    │
│                                                                              │
│     📍 When creating backups:                                               │
│     ```bash                                                                 │
│     # Create encrypted backup                                               │
│     pg_dump your_database | gpg --symmetric --cipher-algo AES256 > backup.gpg│
│                                                                              │
│     # Restore encrypted backup                                              │
│     gpg --decrypt backup.gpg | psql your_database                           │
│     ```                                                                     │
│                                                                              │
│  □ 11. SECURITY HEADERS                                                     │
│                                                                              │
│     📍 Add to your nginx.conf or hosting config:                            │
│     ```nginx                                                                │
│     # Prevent clickjacking                                                  │
│     add_header X-Frame-Options "SAMEORIGIN" always;                         │
│                                                                              │
│     # Prevent MIME type sniffing                                            │
│     add_header X-Content-Type-Options "nosniff" always;                     │
│                                                                              │
│     # Enable XSS protection                                                 │
│     add_header X-XSS-Protection "1; mode=block" always;                     │
│                                                                              │
│     # Strict transport security                                             │
│     add_header Strict-Transport-Security "max-age=31536000" always;         │
│                                                                              │
│     # Content Security Policy                                               │
│     add_header Content-Security-Policy "default-src 'self'" always;         │
│     ```                                                                     │
│                                                                              │
│  □ 12. REGULAR DEPENDENCY UPDATES                                           │
│                                                                              │
│     📍 Check for vulnerabilities:                                           │
│     ```bash                                                                 │
│     npm audit                                                               │
│     ```                                                                     │
│                                                                              │
│     📍 Update dependencies safely:                                          │
│     ```bash                                                                 │
│     npm audit fix        # Safe fixes only                                 │
│     npm update           # Update within version ranges                     │
│     ```                                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 22.3 Security Testing (Simple Methods)

**Test 1: Can You Access Other Users' Data?**
```bash
# 1. Log in as User A
# 2. Note down a URL like: /interview/abc123
# 3. Log out
# 4. Log in as User B
# 5. Try to access: /interview/abc123

# Expected: Should see "Access Denied" or redirect to own dashboard
# If you see User A's data: CRITICAL SECURITY BUG!
```

**Test 2: Can Anonymous Users See Protected Data?**
```bash
# 1. Open a private/incognito browser window
# 2. Try to access: https://yourdomain.com/dashboard
# 3. Try to access: https://yourdomain.com/api/interviews

# Expected: Should redirect to login or show "Unauthorized"
# If you see data: CRITICAL SECURITY BUG!
```

**Test 3: Are API Keys Exposed?**
```bash
# 1. Open your site in browser
# 2. Press F12 (Developer Tools)
# 3. Go to "Network" tab
# 4. Perform some actions (login, create interview)
# 5. Look at request headers

# Expected: No API keys visible (only session tokens)
# If you see "sk-..." or "api_key": CRITICAL SECURITY BUG!
```

### 22.4 Security Incident Response Plan

**If You Discover a Security Problem:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECURITY INCIDENT RESPONSE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  STEP 1: STOP THE BLEEDING (Do within 1 hour)                               │
│  ─────────────────────────────────────────────                               │
│                                                                              │
│  □ If API key exposed:                                                      │
│    - Rotate the key IMMEDIATELY (generate new one)                          │
│    - Revoke the old key                                                     │
│    - Update your environment variables                                      │
│    - Redeploy                                                               │
│                                                                              │
│  □ If database exposed:                                                     │
│    - Enable RLS on affected tables immediately                              │
│    - Change database password                                               │
│    - Review recent access logs                                              │
│                                                                              │
│  □ If user accounts compromised:                                            │
│    - Force password reset for affected users                                │
│    - Invalidate all sessions                                                │
│    - Enable 2FA if not already enabled                                      │
│                                                                              │
│  STEP 2: ASSESS THE DAMAGE (Do within 24 hours)                             │
│  ─────────────────────────────────────────────                               │
│                                                                              │
│  □ Check audit logs for suspicious activity                                 │
│  □ Determine what data may have been accessed                               │
│  □ Identify how the breach occurred                                         │
│  □ Document timeline of events                                              │
│                                                                              │
│  STEP 3: NOTIFY (Do within 72 hours if data breach)                         │
│  ─────────────────────────────────────────────────                           │
│                                                                              │
│  □ If personal data exposed:                                                │
│    - Notify affected users                                                  │
│    - Report to relevant data protection authority (GDPR, etc.)              │
│    - Document notification process                                          │
│                                                                              │
│  STEP 4: FIX AND PREVENT (Do within 1 week)                                 │
│  ──────────────────────────────────────────                                  │
│                                                                              │
│  □ Patch the vulnerability                                                  │
│  □ Add monitoring to detect similar issues                                  │
│  □ Update security documentation                                            │
│  □ Conduct team security training if needed                                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 23. Recovery and Rollback Thinking

> **🔄 What is "Rollback"?**
> 
> Rollback means "undo". If you make a change and it breaks everything, you need a way to quickly go back to how things were before.
> 
> Think of it like the "Undo" button (Ctrl+Z) for your entire application.

### 23.1 The Three Types of Things That Can Go Wrong

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHAT CAN GO WRONG?                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TYPE 1: CODE CHANGES                          Rollback Difficulty: EASY    │
│  ─────────────────────                         ──────────────────────────   │
│  - Updated React component                                                  │
│  - Changed CSS/styling                                                      │
│  - Modified Edge Function logic                                             │
│                                                                              │
│  Recovery: Deploy previous version                                          │
│  Time to recover: 5-15 minutes                                              │
│                                                                              │
│  TYPE 2: CONFIGURATION CHANGES                 Rollback Difficulty: MEDIUM  │
│  ─────────────────────────────                 ────────────────────────────  │
│  - Changed environment variables                                            │
│  - Updated Supabase auth settings                                           │
│  - Modified CORS headers                                                    │
│                                                                              │
│  Recovery: Restore previous settings                                        │
│  Time to recover: 15-60 minutes                                             │
│                                                                              │
│  TYPE 3: DATABASE CHANGES                      Rollback Difficulty: HARD    │
│  ────────────────────────                      ────────────────────────────  │
│  - Added/removed columns                                                    │
│  - Changed data types                                                       │
│  - Deleted data                                                             │
│                                                                              │
│  Recovery: Restore from backup                                              │
│  Time to recover: 30 minutes - 4 hours                                      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 23.2 Before You Make Any Change (Pre-Flight Checklist)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│               PRE-CHANGE SAFETY CHECKLIST                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FOR CODE CHANGES:                                                          │
│  □ Git commit your current state                                            │
│  □ Note the current commit hash (in case you need to rollback)              │
│    ```bash                                                                  │
│    git rev-parse HEAD                                                       │
│    # Example output: abc123def456...                                        │
│    ```                                                                      │
│  □ Verify your changes work locally first                                   │
│                                                                              │
│  FOR CONFIGURATION CHANGES:                                                 │
│  □ Screenshot current settings OR                                           │
│  □ Copy current values to a text file                                       │
│  □ Note what you're about to change and why                                 │
│                                                                              │
│  FOR DATABASE CHANGES:                                                      │
│  □ CREATE A BACKUP FIRST (see command below)                                │
│  □ Write the "undo" migration before you apply the change                   │
│  □ Test on a copy of the database if possible                               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 23.3 Database Backup Commands

**Creating a Backup (DO THIS BEFORE ANY DATABASE CHANGE)**

```bash
# ═══════════════════════════════════════════════════════════════════════════
# 🍎 MAC INSTRUCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Step 1: Open Terminal

# Step 2: Create backup with timestamp
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump "postgresql://user:password@host:5432/database" > backup_$DATE.sql

# Step 3: Verify backup was created
ls -la backup_*.sql

# Step 4: Check backup size (should be more than a few KB)
wc -l backup_$DATE.sql

# ═══════════════════════════════════════════════════════════════════════════
# 🪟 WINDOWS INSTRUCTIONS
# ═══════════════════════════════════════════════════════════════════════════

# Step 1: Open Command Prompt or PowerShell

# Step 2: Create backup with timestamp
set DATE=%date:~10,4%%date:~4,2%%date:~7,2%_%time:~0,2%%time:~3,2%%time:~6,2%
pg_dump "postgresql://user:password@host:5432/database" > backup_%DATE%.sql

# Step 3: Verify backup was created
dir backup_*.sql
```

**For Supabase Cloud:**

```bash
# If using Supabase, you can also backup through their CLI:

# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-id

# Create backup
supabase db dump -f backup.sql
```

### 23.4 Rollback Procedures

#### Rolling Back Code Changes

```bash
# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO: You deployed new code and it broke the site
# ═══════════════════════════════════════════════════════════════════════════

# Option A: Rollback on Vercel (if using Vercel)
# ─────────────────────────────────────────────
# 1. Go to https://vercel.com/dashboard
# 2. Click on your project
# 3. Go to "Deployments" tab
# 4. Find the last working deployment
# 5. Click the "..." menu → "Redeploy"
# 6. Wait 2-3 minutes for deployment

# Option B: Rollback using Git
# ─────────────────────────────
# Step 1: Find the last working commit
git log --oneline -10

# Output will look like:
# abc123 (HEAD) Broken change ← Current (broken)
# def456 Some other change
# ghi789 Last working state ← We want this one

# Step 2: Revert to that commit
git checkout ghi789

# Step 3: Create new branch for the fix
git checkout -b hotfix/rollback-broken-change

# Step 4: Push and deploy
git push origin hotfix/rollback-broken-change

# Option C: Quick Fix - Cherry-pick Revert
# ─────────────────────────────────────────
# If you just need to undo ONE specific commit:
git revert abc123  # Creates a new commit that undoes abc123
git push origin main
```

#### Rolling Back Database Changes

```bash
# ═══════════════════════════════════════════════════════════════════════════
# SCENARIO: You ran a migration and it broke the database
# ═══════════════════════════════════════════════════════════════════════════

# Option A: Restore from backup
# ─────────────────────────────

# ⚠️ WARNING: This replaces ALL current data with backup data!

# Step 1: Stop your application (to prevent new data from being written)
# For Vercel: Go to Settings → Pause project
# For Docker: docker-compose down

# Step 2: Restore the backup
psql "postgresql://user:password@host:5432/database" < backup_20240101_120000.sql

# Step 3: Restart your application
# For Vercel: Resume project
# For Docker: docker-compose up -d

# Option B: Run a "reverse migration"
# ──────────────────────────────────

# If you added a column:
ALTER TABLE your_table DROP COLUMN new_column;

# If you removed a column (can't fully restore data!):
ALTER TABLE your_table ADD COLUMN old_column VARCHAR;
# ⚠️ Data is lost! This only recreates the structure

# If you changed a data type:
ALTER TABLE your_table ALTER COLUMN your_column TYPE old_type;

# Option C: Point-in-time recovery (advanced)
# ──────────────────────────────────────────
# Only available on some managed databases (AWS RDS, etc.)
# Allows restoring to exact moment before the bad change
```

### 23.5 Rollback Decision Flowchart

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              SOMETHING BROKE - WHAT DO I DO?                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                         Site is down or broken                              │
│                                 │                                           │
│                                 ▼                                           │
│                    ┌────────────────────────┐                               │
│                    │ Can users still        │                               │
│                    │ access critical        │                               │
│                    │ features?              │                               │
│                    └────────────────────────┘                               │
│                          │           │                                      │
│                         YES         NO                                      │
│                          │           │                                      │
│                          ▼           ▼                                      │
│             ┌─────────────────┐  ┌─────────────────┐                       │
│             │ Monitor and     │  │ IMMEDIATE       │                       │
│             │ investigate     │  │ ROLLBACK        │                       │
│             │                 │  │                 │                       │
│             │ Take time to    │  │ Don't debug -   │                       │
│             │ find root cause │  │ just rollback!  │                       │
│             └─────────────────┘  └─────────────────┘                       │
│                                          │                                  │
│                                          ▼                                  │
│                           ┌────────────────────────┐                       │
│                           │ What was the last      │                       │
│                           │ thing you changed?     │                       │
│                           └────────────────────────┘                       │
│                              │         │        │                          │
│                           Code      Config   Database                      │
│                              │         │        │                          │
│                              ▼         ▼        ▼                          │
│                         Redeploy   Restore   Restore                       │
│                         previous   previous  from                          │
│                         version    settings  backup                        │
│                              │         │        │                          │
│                              └─────────┼────────┘                          │
│                                        │                                    │
│                                        ▼                                    │
│                           ┌────────────────────────┐                       │
│                           │ Verify site is         │                       │
│                           │ working again          │                       │
│                           │                        │                       │
│                           │ Then investigate       │                       │
│                           │ what went wrong        │                       │
│                           └────────────────────────┘                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 23.6 Backup Schedule (Set This Up Now)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              RECOMMENDED BACKUP SCHEDULE                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                        DATABASE BACKUPS                                │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  FREQUENCY         RETENTION         HOW                              │ │
│  │  ──────────────────────────────────────────────────────────────────── │ │
│  │  Every 6 hours     Keep for 7 days   Automated script                │ │
│  │  Daily             Keep for 30 days  Automated script                │ │
│  │  Weekly            Keep for 90 days  Automated script                │ │
│  │  Monthly           Keep for 1 year   Manual verification             │ │
│  │                                                                        │ │
│  │  For Supabase Pro: Automatic daily backups included                  │ │
│  │  For Self-hosted: Use cron job (see below)                           │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                          CODE BACKUPS                                  │ │
│  ├────────────────────────────────────────────────────────────────────────┤ │
│  │                                                                        │ │
│  │  Git is your backup! Every commit is a "save point"                   │ │
│  │                                                                        │ │
│  │  Best practices:                                                      │ │
│  │  □ Commit frequently (at least daily)                                │ │
│  │  □ Push to remote (GitHub) after every commit                        │ │
│  │  □ Use descriptive commit messages                                   │ │
│  │  □ Tag releases: git tag v1.0.0                                      │ │
│  │                                                                        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                              │
│  AUTOMATED BACKUP SCRIPT (for self-hosted):                                 │
│  ──────────────────────────────────────────                                 │
│                                                                              │
│  Save this as: /scripts/backup.sh                                           │
│  ```bash                                                                    │
│  #!/bin/bash                                                                │
│  DATE=$(date +%Y%m%d_%H%M%S)                                                │
│  BACKUP_DIR=/backups                                                        │
│  DATABASE_URL="postgresql://user:pass@host:5432/db"                         │
│                                                                              │
│  # Create backup                                                            │
│  pg_dump "$DATABASE_URL" > "$BACKUP_DIR/db_$DATE.sql"                       │
│                                                                              │
│  # Compress                                                                 │
│  gzip "$BACKUP_DIR/db_$DATE.sql"                                            │
│                                                                              │
│  # Delete backups older than 30 days                                        │
│  find $BACKUP_DIR -name "db_*.sql.gz" -mtime +30 -delete                    │
│                                                                              │
│  echo "Backup completed: db_$DATE.sql.gz"                                   │
│  ```                                                                        │
│                                                                              │
│  Add to crontab (run every 6 hours):                                        │
│  ```                                                                        │
│  0 */6 * * * /scripts/backup.sh                                             │
│  ```                                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 24. Long-Term Migration Guardrails

> **🛤️ What are "Guardrails"?**
> 
> Guardrails are rules and checks that prevent you from accidentally breaking things over time. Like guardrails on a mountain road - they keep you from driving off a cliff.

### 24.1 The Migration Lifecycle

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              YOUR APPLICATION'S JOURNEY OVER TIME                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  YEAR 1                    YEAR 2-3                   YEAR 4+               │
│  ──────                    ────────                   ───────               │
│                                                                              │
│  ┌─────────────┐           ┌─────────────┐           ┌─────────────┐       │
│  │ Initial     │           │ Growing     │           │ Mature      │       │
│  │ Deployment  │    →      │ & Evolving  │    →      │ & Stable    │       │
│  │             │           │             │           │             │       │
│  │ - Few users │           │ - More data │           │ - Many users│       │
│  │ - Simple    │           │ - New needs │           │ - Complex   │       │
│  │ - Fast      │           │ - Growing   │           │ - Critical  │       │
│  └─────────────┘           └─────────────┘           └─────────────┘       │
│                                                                              │
│  Challenges:               Challenges:               Challenges:            │
│  - Get it working          - Scale database          - Minimize downtime   │
│  - Learn the system        - Add features            - Maintain security   │
│                            - Update dependencies      - Handle legacy code  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 24.2 Guardrail 1: Database Migration Safety

**The Golden Rules of Database Changes:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              DATABASE MIGRATION GOLDEN RULES                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RULE 1: NEVER DELETE COLUMNS IN PRODUCTION WITHOUT A PLAN                  │
│  ─────────────────────────────────────────────────────────                   │
│                                                                              │
│  ❌ WRONG (dangerous):                                                       │
│  ```sql                                                                     │
│  ALTER TABLE users DROP COLUMN old_field;  -- Data gone forever!           │
│  ```                                                                        │
│                                                                              │
│  ✅ RIGHT (safe - 3 step process):                                          │
│                                                                              │
│  Week 1: Stop using the column in code                                      │
│  ```javascript                                                              │
│  // Remove all references to old_field in your code                        │
│  // Deploy this change first                                               │
│  ```                                                                        │
│                                                                              │
│  Week 2: Rename column (not delete)                                         │
│  ```sql                                                                     │
│  ALTER TABLE users RENAME COLUMN old_field TO _deprecated_old_field;       │
│  ```                                                                        │
│                                                                              │
│  Week 4+: Delete after confirming nothing uses it                           │
│  ```sql                                                                     │
│  -- After 2+ weeks with no issues:                                          │
│  ALTER TABLE users DROP COLUMN _deprecated_old_field;                       │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  RULE 2: ALWAYS ADD COLUMNS AS NULLABLE FIRST                               │
│  ─────────────────────────────────────────────                               │
│                                                                              │
│  ❌ WRONG (will fail if table has data):                                     │
│  ```sql                                                                     │
│  ALTER TABLE users ADD COLUMN new_field VARCHAR NOT NULL;                   │
│  -- Error: cannot add non-null column to table with existing rows          │
│  ```                                                                        │
│                                                                              │
│  ✅ RIGHT (safe - 3 step process):                                          │
│                                                                              │
│  Step 1: Add as nullable                                                    │
│  ```sql                                                                     │
│  ALTER TABLE users ADD COLUMN new_field VARCHAR;                            │
│  ```                                                                        │
│                                                                              │
│  Step 2: Backfill existing rows                                             │
│  ```sql                                                                     │
│  UPDATE users SET new_field = 'default_value' WHERE new_field IS NULL;     │
│  ```                                                                        │
│                                                                              │
│  Step 3: Add NOT NULL constraint                                            │
│  ```sql                                                                     │
│  ALTER TABLE users ALTER COLUMN new_field SET NOT NULL;                     │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  RULE 3: WRITE REVERSIBLE MIGRATIONS                                        │
│  ─────────────────────────────────────                                       │
│                                                                              │
│  Every migration file should have an "up" and a "down":                     │
│                                                                              │
│  ```sql                                                                     │
│  -- migration_001_add_phone_field.sql                                       │
│                                                                              │
│  -- UP (apply the change)                                                   │
│  ALTER TABLE users ADD COLUMN phone VARCHAR(20);                            │
│                                                                              │
│  -- DOWN (undo the change) - save this somewhere!                           │
│  -- ALTER TABLE users DROP COLUMN phone;                                    │
│  ```                                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 24.3 Guardrail 2: Dependency Management

**Keeping Your Dependencies Safe:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              DEPENDENCY MANAGEMENT RULES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RULE 1: PIN YOUR VERSIONS                                                  │
│  ─────────────────────────                                                   │
│                                                                              │
│  In package.json:                                                           │
│                                                                              │
│  ❌ RISKY (any version could break things):                                  │
│  ```json                                                                    │
│  "react": "^18.0.0"     // Could install 18.99.99 which might break!       │
│  "lodash": "*"          // Could install ANY version!                       │
│  ```                                                                        │
│                                                                              │
│  ✅ SAFE (exact versions):                                                   │
│  ```json                                                                    │
│  "react": "18.3.1"      // Always installs exactly this version            │
│  "lodash": "4.17.21"    // Always installs exactly this version            │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  RULE 2: UPDATE DEPENDENCIES REGULARLY (BUT CAREFULLY)                      │
│  ─────────────────────────────────────────────────────                       │
│                                                                              │
│  Recommended schedule:                                                      │
│  - Security updates: Same day                                               │
│  - Patch versions (1.0.x): Weekly                                           │
│  - Minor versions (1.x.0): Monthly                                          │
│  - Major versions (x.0.0): Quarterly (with testing)                         │
│                                                                              │
│  Commands:                                                                  │
│  ```bash                                                                    │
│  # Check what's outdated                                                    │
│  npm outdated                                                               │
│                                                                              │
│  # Check for security issues                                                │
│  npm audit                                                                  │
│                                                                              │
│  # Update safely (only patch versions)                                      │
│  npm update --save                                                          │
│                                                                              │
│  # Update specific package                                                  │
│  npm install package-name@latest                                            │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  RULE 3: TEST AFTER EVERY UPDATE                                            │
│  ────────────────────────────────                                            │
│                                                                              │
│  Minimum testing after dependency update:                                   │
│  □ Application starts without errors                                        │
│  □ Login/logout works                                                       │
│  □ Create a test interview                                                  │
│  □ Submit test answers                                                      │
│  □ View results                                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 24.4 Guardrail 3: Documentation Requirements

**What You MUST Document:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REQUIRED DOCUMENTATION                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  FILE: RUNBOOK.md (Create this file)                                        │
│  ─────────────────────────────────────                                       │
│                                                                              │
│  Must contain:                                                              │
│                                                                              │
│  ## 1. How to Access Production                                             │
│  - URL: https://yourdomain.com                                              │
│  - Admin login: (stored in password manager)                                │
│  - Database access: (connection details)                                    │
│                                                                              │
│  ## 2. How to Deploy                                                        │
│  1. Push to main branch                                                     │
│  2. Vercel automatically deploys                                            │
│  3. Check deployment at vercel.com/dashboard                                │
│                                                                              │
│  ## 3. How to Rollback                                                      │
│  1. Go to Vercel dashboard                                                  │
│  2. Click Deployments                                                       │
│  3. Find previous deployment                                                │
│  4. Click Redeploy                                                          │
│                                                                              │
│  ## 4. Common Problems and Fixes                                            │
│  - Problem: "Login not working"                                             │
│    Fix: Check Supabase Auth settings                                        │
│                                                                              │
│  - Problem: "AI features failing"                                           │
│    Fix: Check API key in environment variables                              │
│                                                                              │
│  ## 5. Emergency Contacts                                                   │
│  - Primary: name@example.com                                                │
│  - Backup: name2@example.com                                                │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  FILE: CHANGELOG.md (Keep this updated)                                     │
│  ───────────────────────────────────────                                     │
│                                                                              │
│  ## [1.2.0] - 2024-01-15                                                    │
│  ### Added                                                                  │
│  - New proctoring feature                                                   │
│  ### Changed                                                                │
│  - Updated question generation AI                                           │
│  ### Fixed                                                                  │
│  - Login timeout issue                                                      │
│  ### Migration Notes                                                        │
│  - Run: npm run migrate                                                     │
│  - Update env: NEW_API_KEY required                                         │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  FILE: .env.example (Template for environment variables)                    │
│  ────────────────────────────────────────────────────────                    │
│                                                                              │
│  # Required                                                                 │
│  VITE_SUPABASE_URL=your_supabase_url                                        │
│  VITE_SUPABASE_ANON_KEY=your_anon_key                                       │
│                                                                              │
│  # Optional                                                                 │
│  OPENAI_API_KEY=your_openai_key                                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 24.5 Guardrail 4: Monitoring and Alerts

**What to Monitor (Simple Version):**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              ESSENTIAL MONITORING                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  TIER 1: FREE/EASY MONITORING                                               │
│  ─────────────────────────────                                               │
│                                                                              │
│  □ Uptime Monitoring (Is site up?)                                          │
│    - UptimeRobot (free): https://uptimerobot.com                            │
│    - Set up: Enter your URL, get notified if it goes down                   │
│                                                                              │
│  □ Error Tracking (What errors are happening?)                              │
│    - Sentry (free tier): https://sentry.io                                  │
│    - Already integrated in ErrorBoundary component                          │
│                                                                              │
│  □ Supabase Dashboard (built-in)                                            │
│    - Database health                                                        │
│    - Edge function logs                                                     │
│    - Authentication events                                                  │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  WHAT TO ALERT ON:                                                          │
│                                                                              │
│  🔴 CRITICAL (Wake someone up):                                             │
│     - Site is down                                                          │
│     - Login is broken                                                       │
│     - Database is unreachable                                               │
│                                                                              │
│  🟠 WARNING (Check within hours):                                           │
│     - Error rate increased 10x                                              │
│     - Response time > 5 seconds                                             │
│     - Disk space < 20%                                                      │
│                                                                              │
│  🟡 INFO (Check daily):                                                     │
│     - New user signups                                                      │
│     - Successful interview completions                                      │
│     - API usage metrics                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 25. Supabase Exit Strategy

> **🚪 What is an "Exit Strategy"?**
> 
> An exit strategy is your plan for leaving a service if you need to. It's like knowing where the emergency exits are before the movie starts - you hope you never need them, but you're glad they're there.
> 
> This section helps you understand: "What if I need to completely leave Supabase someday?"

### 25.1 Why Would You Need to Exit?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REASONS YOU MIGHT NEED TO EXIT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  BUSINESS REASONS:                                                          │
│  ─────────────────                                                           │
│  • Supabase pricing increases significantly                                 │
│  • Your company requires all data on-premises                               │
│  • Acquisition/merger requires specific cloud provider                      │
│  • Compliance requirements change                                           │
│                                                                              │
│  TECHNICAL REASONS:                                                         │
│  ──────────────────                                                          │
│  • You outgrow Supabase's capabilities                                      │
│  • You need features Supabase doesn't offer                                 │
│  • Performance requirements exceed Supabase limits                          │
│                                                                              │
│  WORST CASE (RARE):                                                         │
│  ─────────────────                                                           │
│  • Supabase goes out of business                                            │
│  • Major security breach affects your data                                  │
│  • Service becomes unavailable for extended period                          │
│                                                                              │
│  ⚠️ IMPORTANT: None of these are likely in the short term!                  │
│  Supabase is well-funded and growing. But planning ahead is wise.          │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 25.2 What Makes TalentGeenie Portable?

**Good News - Most of Your App is Already Portable:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              PORTABILITY ASSESSMENT                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ✅ FULLY PORTABLE (No changes needed)                          ~70% of app│
│  ─────────────────────────────────────                                       │
│                                                                              │
│  • React Frontend (src/)                                                    │
│    - Standard React code                                                    │
│    - Works with any backend                                                 │
│                                                                              │
│  • Database Schema (migrations/)                                            │
│    - Standard PostgreSQL                                                    │
│    - Works on any PostgreSQL server                                         │
│                                                                              │
│  • Business Logic                                                           │
│    - Stored in Edge Functions                                               │
│    - Can be converted to Node.js/Python                                     │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  ⚠️ NEEDS WORK TO PORT (Supabase-specific)                       ~30% of app│
│  ──────────────────────────────────────────                                  │
│                                                                              │
│  • Edge Functions (70+ functions)                                           │
│    - Written in Deno (Supabase's runtime)                                   │
│    - Need conversion to Node.js for other platforms                         │
│    - Time estimate: 2-4 weeks of developer work                             │
│                                                                              │
│  • Authentication                                                           │
│    - Uses Supabase Auth                                                     │
│    - Need to replace with Auth0/Firebase/Custom                             │
│    - Time estimate: 1-2 weeks                                               │
│                                                                              │
│  • Real-time Features                                                       │
│    - Uses Supabase Realtime                                                 │
│    - Need to replace with Pusher/Socket.io                                  │
│    - Time estimate: 1 week                                                  │
│                                                                              │
│  • Storage                                                                  │
│    - Uses Supabase Storage                                                  │
│    - Need to replace with S3/CloudFlare R2                                  │
│    - Time estimate: 1 week                                                  │
│                                                                              │
│  TOTAL ESTIMATED EXIT TIME: 4-8 weeks of developer work                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 25.3 Exit Plan - Step by Step

**Phase 1: Data Export (Can Do Anytime - Do This Now as Practice)**

```bash
# ═══════════════════════════════════════════════════════════════════════════
# EXPORTING YOUR DATA FROM SUPABASE
# Do this monthly as a backup AND as exit preparation
# ═══════════════════════════════════════════════════════════════════════════

# Step 1: Export database schema and data
# ─────────────────────────────────────────

# Option A: Using Supabase CLI
supabase db dump --file full_backup.sql

# Option B: Using pg_dump directly
pg_dump "postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres" > full_backup.sql

# ─────────────────────────────────────────────────────────────────────────────

# Step 2: Export Storage files
# ─────────────────────────────

# List all buckets and their contents
# Then download using the Supabase SDK or API

# Using Node.js script (save as export-storage.js):
```

```javascript
// export-storage.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-service-role-key'  // Use service role key for full access
);

async function exportStorage() {
  // List all buckets
  const { data: buckets } = await supabase.storage.listBuckets();
  
  for (const bucket of buckets) {
    console.log(`Exporting bucket: ${bucket.name}`);
    
    // Create local directory
    fs.mkdirSync(`./storage-export/${bucket.name}`, { recursive: true });
    
    // List all files in bucket
    const { data: files } = await supabase.storage.from(bucket.name).list();
    
    for (const file of files) {
      // Download each file
      const { data } = await supabase.storage
        .from(bucket.name)
        .download(file.name);
      
      // Save locally
      const buffer = Buffer.from(await data.arrayBuffer());
      fs.writeFileSync(`./storage-export/${bucket.name}/${file.name}`, buffer);
    }
  }
  
  console.log('Export complete!');
}

exportStorage();
```

```bash
# Run the export
node export-storage.js

# Step 3: Export Auth users (if needed)
# ─────────────────────────────────────

# Users are stored in auth.users table
# Export using SQL:
psql "your-connection-string" -c "COPY auth.users TO STDOUT WITH CSV HEADER" > users_export.csv

# ⚠️ Note: Passwords cannot be exported (they're hashed)
# Users will need to reset passwords on new system
```

**Phase 2: Setting Up Alternative (When You Decide to Exit)**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              REPLACEMENT OPTIONS BY COMPONENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SUPABASE COMPONENT          REPLACEMENT OPTIONS                            │
│  ───────────────────────────────────────────────────────────────────────    │
│                                                                              │
│  Database (PostgreSQL)                                                      │
│  ├─► AWS RDS PostgreSQL                                                     │
│  ├─► Google Cloud SQL                                                       │
│  ├─► Azure Database for PostgreSQL                                          │
│  ├─► DigitalOcean Managed Databases                                         │
│  └─► Self-hosted PostgreSQL                                                 │
│                                                                              │
│  Edge Functions (Deno)                                                      │
│  ├─► AWS Lambda (Node.js)                                                   │
│  ├─► Google Cloud Functions                                                 │
│  ├─► Vercel Serverless Functions                                            │
│  └─► Self-hosted Express.js / FastAPI                                       │
│                                                                              │
│  Authentication                                                             │
│  ├─► Auth0                                                                  │
│  ├─► Firebase Auth                                                          │
│  ├─► AWS Cognito                                                            │
│  └─► Self-hosted (Passport.js + JWT)                                        │
│                                                                              │
│  Storage                                                                    │
│  ├─► AWS S3                                                                 │
│  ├─► Cloudflare R2                                                          │
│  ├─► Google Cloud Storage                                                   │
│  └─► MinIO (self-hosted S3-compatible)                                      │
│                                                                              │
│  Realtime                                                                   │
│  ├─► Pusher                                                                 │
│  ├─► Socket.io                                                              │
│  ├─► Ably                                                                   │
│  └─► Self-hosted WebSocket server                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Phase 3: Migration Steps**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              MIGRATION EXECUTION PLAN                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  WEEK 1-2: SETUP NEW INFRASTRUCTURE                                         │
│  ───────────────────────────────────                                         │
│  □ Set up new PostgreSQL database                                           │
│  □ Import schema from Supabase export                                       │
│  □ Set up new authentication service                                        │
│  □ Set up new storage service                                               │
│  □ Test connections work                                                    │
│                                                                              │
│  WEEK 3-4: CONVERT EDGE FUNCTIONS                                           │
│  ─────────────────────────────────                                           │
│  □ Convert Deno functions to Node.js (see Section 12)                       │
│  □ Deploy to new serverless platform                                        │
│  □ Test each function individually                                          │
│                                                                              │
│  WEEK 5: UPDATE FRONTEND                                                    │
│  ─────────────────────────────                                               │
│  □ Replace Supabase client with new clients                                 │
│  □ Update authentication flows                                              │
│  □ Update storage references                                                │
│  □ Update API endpoints                                                     │
│                                                                              │
│  WEEK 6: DATA MIGRATION                                                     │
│  ─────────────────────────                                                   │
│  □ Export final data from Supabase                                          │
│  □ Import into new database                                                 │
│  □ Migrate storage files                                                    │
│  □ Notify users about password reset                                        │
│                                                                              │
│  WEEK 7: TESTING & CUTOVER                                                  │
│  ─────────────────────────────                                               │
│  □ Full testing on new infrastructure                                       │
│  □ Performance testing                                                      │
│  □ Security audit                                                           │
│  □ Plan cutover window (usually a weekend)                                  │
│                                                                              │
│  WEEK 8: GO LIVE                                                            │
│  ───────────────────                                                         │
│  □ Final data sync                                                          │
│  □ Update DNS to point to new infrastructure                                │
│  □ Monitor for issues                                                       │
│  □ Keep Supabase active for 30 days as fallback                             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 25.4 Exit Checklist (Save This!)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              SUPABASE EXIT CHECKLIST                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PREPARATION (Do now, even if not exiting):                                 │
│  □ Monthly database backups stored locally                                  │
│  □ Monthly storage exports                                                  │
│  □ Document all Supabase-specific code locations                            │
│  □ Keep list of all Edge Functions and their purposes                       │
│  □ Maintain up-to-date schema documentation                                 │
│                                                                              │
│  PRE-MIGRATION:                                                             │
│  □ Choose replacement services                                              │
│  □ Estimate costs of new infrastructure                                     │
│  □ Allocate developer resources                                             │
│  □ Create detailed project plan                                             │
│  □ Set up new infrastructure (don't migrate yet)                            │
│                                                                              │
│  MIGRATION:                                                                 │
│  □ Export all data                                                          │
│  □ Convert Edge Functions to new platform                                   │
│  □ Update frontend to use new services                                      │
│  □ Test everything thoroughly                                               │
│  □ Plan downtime window for cutover                                         │
│                                                                              │
│  POST-MIGRATION:                                                            │
│  □ Monitor new system closely                                               │
│  □ Keep Supabase active for 30 days as rollback option                      │
│  □ Update all documentation                                                 │
│  □ Train team on new infrastructure                                         │
│  □ Cancel Supabase subscription after confirmation                          │
│                                                                              │
│  CONTACTS TO NOTIFY:                                                        │
│  □ Users (if any downtime)                                                  │
│  □ Support team                                                             │
│  □ Any integrated systems                                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 25.5 Reducing Lock-In Going Forward

**Best Practices to Stay Portable:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│              STAYING PORTABLE - BEST PRACTICES                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. ABSTRACT YOUR DEPENDENCIES                                              │
│  ─────────────────────────────                                               │
│                                                                              │
│  Create wrapper functions so Supabase isn't called directly:                │
│                                                                              │
│  ❌ TIGHT COUPLING (hard to migrate):                                        │
│  ```javascript                                                              │
│  // Called throughout your app                                              │
│  const { data } = await supabase.from('users').select('*');                 │
│  ```                                                                        │
│                                                                              │
│  ✅ ABSTRACTED (easy to migrate):                                            │
│  ```javascript                                                              │
│  // In src/lib/database.ts                                                  │
│  export async function getUsers() {                                         │
│    // Change only this file when switching providers                        │
│    const { data } = await supabase.from('users').select('*');               │
│    return data;                                                             │
│  }                                                                          │
│                                                                              │
│  // In your components                                                      │
│  import { getUsers } from '@/lib/database';                                 │
│  const users = await getUsers();                                            │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  2. USE STANDARD SQL                                                        │
│  ────────────────────                                                        │
│                                                                              │
│  Avoid Supabase-only features in database:                                  │
│                                                                              │
│  ❌ SUPABASE-SPECIFIC:                                                       │
│  ```sql                                                                     │
│  -- Uses Supabase's auth schema directly                                    │
│  SELECT * FROM auth.users;                                                  │
│  ```                                                                        │
│                                                                              │
│  ✅ PORTABLE:                                                                │
│  ```sql                                                                     │
│  -- Uses your own profiles table                                            │
│  SELECT * FROM public.profiles;                                             │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  3. DOCUMENT SUPABASE-SPECIFIC CODE                                         │
│  ───────────────────────────────────                                         │
│                                                                              │
│  Add comments marking Supabase-specific parts:                              │
│                                                                              │
│  ```javascript                                                              │
│  // @supabase-specific - Replace with S3 SDK for AWS migration              │
│  const { data } = await supabase.storage                                    │
│    .from('documents')                                                       │
│    .upload(path, file);                                                     │
│  ```                                                                        │
│                                                                              │
│  ────────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  4. REGULAR EXPORT TESTING                                                  │
│  ──────────────────────────                                                  │
│                                                                              │
│  Test your export/import process quarterly:                                 │
│  □ Export database                                                          │
│  □ Export storage files                                                     │
│  □ Try restoring to a local PostgreSQL                                      │
│  □ Verify data integrity                                                    │
│                                                                              │
│  This ensures your backups actually work!                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

**Congratulations!** 🎉 

You now have comprehensive documentation for:

- **Deployment** - From zero to production
- **Architecture** - Understanding the boundaries
- **Security** - Protecting your application
- **Recovery** - Handling problems gracefully
- **Long-term maintenance** - Keeping things healthy over years
- **Exit strategy** - Freedom to move if needed

For ongoing maintenance:
- Monitor your infrastructure
- Keep dependencies updated
- Backup database regularly
- Review security configurations monthly
- Test your backup restoration quarterly

**Choose your path:**
- **Option A** (Supabase-hosted): Best for most users - quick, easy, and Edge Functions work without changes
- **Option B** (Node.js): For enterprises needing complete control - requires significant development effort
- **Option C** (Self-hosted Supabase): For tech teams wanting full Supabase experience on own servers
