# CVHS Flight School

A GitHub Pages-compatible ground-school portal based on the 17 chapters of the FAA *Pilot's Handbook of Aeronautical Knowledge*, FAA-H-8083-25C.

## Run on your computer

1. Install Node.js 22 or newer.
2. Open this folder in a terminal.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the local address shown in the terminal.

Guest progress works immediately and is saved in the browser.

## Activate free student accounts

The site uses Supabase's free tier for email/password accounts and cross-device progress.

1. Create a free project at https://supabase.com.
2. Open the project's SQL Editor and run `supabase-schema.sql`.
3. Copy `.env.example` to `.env.local`.
4. In Supabase, open Project Settings > API and copy the project URL and public anonymous key into `.env.local`.
5. In Authentication > URL Configuration, add your GitHub Pages URL as the Site URL and an allowed Redirect URL.
6. Restart `npm run dev`.

Never put the Supabase service-role key in this project. The anonymous browser key is designed to be public; database security is enforced by the row-level security policies in `supabase-schema.sql`.

## Publish with GitHub Pages

1. Create a GitHub repository and upload this project's contents.
2. In the repository, open Settings > Secrets and variables > Actions.
3. Add repository secrets named `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
4. Open Settings > Pages and select **GitHub Actions** as the source.
5. Push to the `main` branch. The included workflow builds and publishes the site.

The Vite configuration uses relative asset paths, so it works for both a user site and a project site.

## Current scope

- 17 modules with the official FAA chapter titles and embedded official FAA chapter PDFs
- Device-local progress for guests
- Email/password accounts and cloud progress when Supabase is connected
- Responsive desktop and mobile layout
- Important Resources library with the complete FAA handbook


## Expanded quiz banks
This build includes 240 machine-readable questions for each of Chapters 1–17 (4,080 question records total). A 20-question attempt is selected from the chapter bank with topic coverage, family-aware selection, and recent-question avoidance. Unfinished attempts auto-save locally and resume when the student reopens that module's quiz.
