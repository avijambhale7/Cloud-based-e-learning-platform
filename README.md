# ☁️ CloudLearn – Cloud-Based E-Learning Platform

**Micro Project – Cloud Computing**

## Aim
To build a free e-learning website that runs entirely on the cloud: the frontend on a cloud host and the backend (login and database) on **Supabase**.

## Features
- Course catalog with search and category filter
- Student sign up and login with **username + password** (Supabase Auth)
- Enroll in courses and watch video lessons
- Tick off lessons; progress is saved in the cloud database and syncs across devices
- Dashboard showing enrolled courses, completed courses and average progress
- Dark mode, mobile-friendly design, and toast notifications
- Demo mode: works without Supabase too, saving data in the browser

## Technologies Used
| Part | Technology |
|------|-----------|
| Frontend | HTML, CSS, JavaScript |
| Backend (BaaS) | Supabase |
| Authentication | Supabase Auth (username + password) |
| Database | Supabase PostgreSQL with Row Level Security |
| Videos | YouTube embeds |
| Hosting | GitHub Pages / Netlify (free) |

## Architecture
```
Student (browser) ──► Frontend (GitHub Pages / Netlify) ──► Supabase
                                                            ├─ Auth (login / sign up)
                                                            └─ PostgreSQL (courses, enrollments)
```

## Project Files
```
index.html            → page structure
style.css             → design, dark mode, mobile layout
script.js             → app logic (courses, auth, enrollment, progress)
config.js             → Supabase URL and anon key
supabase/schema.sql   → database tables, security rules and sample courses
```

## Database Tables
| Table | Columns | Purpose |
|-------|---------|---------|
| `courses` | id, title, category, level, icon, duration, description, video_url, lessons[] | Course catalog (anyone can read) |
| `enrollments` | user_id, course_id, completed_lessons[], enrolled_at | Which student enrolled in what, and their progress |

**Row Level Security (RLS)** ensures each student can only read and change their own enrollments.

## Supabase Setup (free, about 5 minutes)
1. Go to https://supabase.com, sign in with GitHub and click **New project** (free plan).
2. When it's ready, open **SQL Editor → New query**, paste everything from `supabase/schema.sql`, and click **Run**.
   This creates the tables, security rules and all 22 courses. It is safe to run again whenever courses are added.
3. Open **Project Settings → API** and copy the **Project URL** and the **anon public** key.
4. Paste them into `config.js`:
   ```js
   window.CLOUDLEARN_CONFIG = {
     SUPABASE_URL: "https://xxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbGciOi...",
   };
   ```
5. **Required:** go to **Authentication → Sign In / Providers** and turn off **Confirm email**, then click **Save changes**.
   Students log in with a username; behind the scenes it's stored as `username@cloudlearn.app`, and no email is ever sent.
6. Open the site. The yellow "Demo mode" banner disappears, and sign ups now appear under **Authentication → Users** in Supabase.

> The anon key is meant to be public. Your data is protected by the RLS policies, not by hiding the key.
> Never put the **service_role** key in the frontend.

**Adding courses:** open **Table Editor → courses** in Supabase and insert a row. It shows up on the site immediately; no code changes are needed.

## How to Run Locally
Double-click `index.html`, or use the VS Code **Live Server** extension.

## How to Deploy (Free)

### Option 1: GitHub Pages
1. Push the code to GitHub.
2. In the repo, go to **Settings → Pages → Branch: main → Save**.
3. Your site will be live at `https://<username>.github.io/Cloud-based-e-learning-platform/`.
4. In Supabase, go to **Authentication → URL Configuration** and set the **Site URL** to that link.

### Option 2: Netlify
1. Go to https://app.netlify.com/drop
2. Drag and drop the project folder. You'll get a live link right away.

## Cloud Concepts Used
- **SaaS**: students use the platform through a browser with nothing to install.
- **BaaS (Backend as a Service)**: Supabase provides the database and login, so there's no server to manage.
- **Serverless**: no virtual machines; the cloud runs everything.
- **Scalability**: Supabase and the host handle more users automatically.
- **Security**: authentication and Row Level Security in the cloud database.
- **Free cost**: Supabase free tier + GitHub Pages / Netlify = ₹0 to run.
- **Availability**: accessible 24/7 from any device, with progress synced through the cloud.

## Future Scope
- Upload your own videos to Supabase Storage
- Quizzes and downloadable certificates
- Admin panel to add courses from the website
- Login with Google (Supabase OAuth)
