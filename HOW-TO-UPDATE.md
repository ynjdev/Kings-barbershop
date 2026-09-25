# How to update the Kings Barbershop site

## Every time you want to push a change

**1. Open cmd and go to the right folder**

```
cd "C:\Users\yoosu\OneDrive\Desktop\Be$a Dev\kings-barbershop"
```

Keep the quotes: the folder name has a space in it.

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

Vercel sees the push and rebuilds the live site automatically, usually within a minute.

When the push finishes, note the last code git prints on the `main -> main` line. In `e736e82..d28402d  main -> main`, your code is `d28402d`.

**4. Check it went live**

1. Go to vercel.com, open the `kings-barbershop` project and click **Deployments**.
2. The top row should show your commit message and the same code from step 3.
3. Read the status:
   - **Ready** with a **blue Production** badge: it's live. Grey Production badges are older versions.
   - **Building**: wait a minute and refresh.
   - **Error**: click the row, open **Logs**, and screenshot it.
4. Open the site and press **Ctrl+F5** so your browser loads the new version instead of an old copy.

To see the WhatsApp/Facebook link preview, click the deployment and open the **Open Graph** tab.

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
- **Vercel says "Stale"** → you're looking at an old deployment. Go back to the Deployments list and use the top row.
- **Live site looks unchanged but Vercel shows Ready + blue Production** → your browser is showing a saved copy. Press Ctrl+F5.
