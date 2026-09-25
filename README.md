This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

Install dependencies with `npm install`. Create `.env.local` with the project's
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and
`NEXT_PUBLIC_API_URL` before running the app. Use the Supabase public anon key,
never a service-role key. This file is ignored by Git.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Navigation and sign-in

General sign-in at `/auth` opens `/dashboard`, a task chooser for Master Resume,
Resume Optimization, and recruiter help. Recruiter help links to the existing
`https://talentseek.ca/contact/` page, not the restricted staff tool. The shared
navigation includes Home and Sign Out. The optimizer remains at `/` to preserve
existing links; explicit links to it still return directly there after login.

Link directly to the desired app page from WordPress, for example
`https://app.talentseek.ca/master-resume`. Signed-out visitors are redirected to
`/auth?next=%2Fmaster-resume`, and successful sign-in returns them to that page.
Query parameters are preserved. Explicit sign-in links can also use this `next`
parameter. Return destinations are limited to existing app pages; role checks
still apply to admin and recruiter routes.

Switching between Sign In and Create Account retains the destination. If email
confirmation is required, users can confirm their email and then sign in from
the original tab. Cross-device email-confirmation return routing is not covered
by this change.

Run `npm test` for navigation, redirect safety, role-access, and session-cookie
regression tests. Run `npm run build` for production validation. If Turbopack
cannot bind its internal port in a restricted environment, use
`npm run build -- --webpack`.

Before release, test with a real Supabase test account: open `/master-resume`
while signed out, sign in, confirm the destination, navigate between resume
tools, and sign out. Repeat for permitted and denied admin/recruiter roles.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
