# SeatShare: staff commuter pilot

A phone web app for staff to share the drive to work. Drivers post rides on set corridors, riders book seats at fixed pickup points, and an admin checks drivers and sets fares. Phases 1 and 2 of the build.

Stack: React (Vite) on Vercel, Supabase for login, database and security rules.

## Setting it up

**1. Supabase project**
Create a free project at supabase.com. In the SQL Editor, run `supabase/schema.sql`, then `supabase/seed.sql`. The seed corridors, pickup points and fares are placeholders; change them in the admin panel later.

**2. Sign in by code, not link**
In Supabase Authentication settings, open the email templates and edit the Magic Link template so the email shows `{{ .Token }}`. That makes the email carry a six digit code, which works better on phones than a link.

**3. Email delivery (important)**
Supabase's built in email sender only allows a handful of emails an hour. That is fine for you testing alone but not for a pilot. Connect a proper sender under the SMTP settings in Authentication before inviting others.

**4. Run it on your computer**
Copy `.env.example` to `.env` and fill in the project URL and anon key from Supabase's API settings. Then:

    npm install
    npm run dev

**5. Deploy**
Push to GitHub, import the repo in Vercel, and add the same two environment variables there. Put the Vercel address in Supabase's URL settings as the Site URL.

**6. Make yourself admin**
Sign in once through the app and complete your profile. Then in the SQL Editor run:

    update public.profiles set role = 'admin', status = 'active' where email = 'you@example.com';

Refresh the app and the Admin tab appears.

**7. Install on a phone**
Open the Vercel address in Chrome or Safari and choose Add to Home Screen.

## How the security works

Anyone can sign up with a personal email, but every new account waits for an admin to check the staff ID and approve it. Unapproved accounts cannot see rides, book or drive. Staff IDs are unique, so one person cannot register twice. Nobody can make themselves admin or verify their own car. Editing car details sends the car back for checking. A driver can only post rides when their car is checked and their licence and insurance dates are current. Bookings can only be made through the booking function, which locks the ride and checks seats, so two people cannot take the last seat. Riders and drivers only see each other's details once a seat is booked.

## Not built yet

Phase 3: trip start and end, live location sharing, SOS alert.
Phase 4: ratings, monthly report export.
Notifications: drivers are not yet alerted to new bookings and must open the app to see them. This is the first thing to add after the phases above.
