# How to update the Kings Barbershop site

## Every time you want to push a change

**1. Open cmd and go to the right folder**

```
cd C:\Users\yoosu\Downloads\kings-barbershop-repo\kings-barbershop
```

Check you're in the right spot:

```
dir
```

You should see `index.html`, `README.md`, `.gitignore` (plus `og-image.jpg`, the favicon files, `robots.txt` and `sitemap.xml` once you've added them). If you see a folder inside a folder, you're in the wrong place — go up or down a level and try again.

**2. Replace the files**

If you got a single `index.html`, drag it in and overwrite the old one.

If you got a zip, open it, select every file inside, and drag them all into this folder. Overwrite when Windows asks. Don't drag the zip's own folder in, only the files.

**3. Push it**

```
git add .
git commit -m "what you changed, in a few words"
git push
```

Done. Vercel sees the push and rebuilds the live site automatically — no need to touch vercel.com.

---

## What each command actually does (plain English)

| Command | What it means |
|---|---|
| `cd <folder>` | "Go into this folder" — everything after this runs *inside* that folder |
| `dir` | "List what's in this folder" — use this to check you're in the right place |
| `git status` | "What's changed since my last save?" |
| `git log --oneline` | "Show me the history of saves in this folder" — good for confirming it's the *right* repo |
| `git add .` | "Stage everything I changed" — gets it ready to save |
| `git commit -m "..."` | "Save this version" — the message is just a note to your future self |
| `git push` | "Send my saved version to GitHub" — this is the step that actually updates the live site |
| `git remote -v` | "What GitHub repo is this folder connected to?" |

---

## If something looks wrong

- **Error mentions a file or project name you don't recognize** → you're in the wrong folder. Run `dir` and `git log --oneline` to check.
- **"Everything up-to-date" but you know you changed something** → you're probably not actually in the folder with your changes. `dir` again.
- **"not a git repository"** → you're outside the `kings-barbershop` folder — the one with the hidden `.git` folder in it.
