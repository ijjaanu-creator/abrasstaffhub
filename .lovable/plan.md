

# Push Notification Reminders for Staff (Every 30 Minutes)

## What This Does

Staff members who have location tracking enabled will receive a push notification every 30 minutes reminding them to open the app. This helps keep their live location updated even when they close or background the app.

The notification will look like a friendly reminder: *"Open Abras Staff Hub to keep your location updated"* -- and tapping it will open the app directly.

## How It Works

1. When a staff member checks in, the app asks for **notification permission** on their phone
2. Their notification subscription is saved to the database
3. A scheduled backend job runs every 30 minutes and sends push notifications to all checked-in staff who have location tracking enabled
4. Tapping the notification opens the app, which automatically resumes location tracking

## Implementation Steps

### Step 1: Generate VAPID Keys (Required for Push Notifications)

Push notifications require special security keys called VAPID keys. A backend function will be created to generate these, and the public key will need to be stored as a secret.

- Create a VAPID key pair (a one-time setup)
- Store the **private key** and **email** as backend secrets
- The **public key** will be used in the app code

### Step 2: Database Changes

Create a new table `push_subscriptions` to store each staff member's notification subscription:

- `id` (primary key)
- `staff_id` (links to staff member)
- `user_id` (links to user account)
- `endpoint` (the push service URL)
- `p256dh` (encryption key)
- `auth` (authentication secret)
- `created_at` (timestamp)

Add proper security policies so staff can only manage their own subscriptions.

### Step 3: Custom Service Worker

Create a custom service worker file that:

- Listens for incoming push notifications
- Shows the notification with the reminder message and the app icon
- Opens the app when the notification is tapped

### Step 4: Notification Permission & Subscription (Frontend)

Create a new hook (`use-push-notifications.ts`) that:

- Requests notification permission from the staff's browser/phone
- Subscribes to push notifications using the VAPID public key
- Saves the subscription to the database
- This is triggered automatically when a staff member checks in

Update the Mark Attendance page to:

- Request notification permission after a successful check-in
- Show a small prompt if permission hasn't been granted yet

### Step 5: Backend Function to Send Notifications

Create a new backend function (`send-tracking-reminder`) that:

- Queries for all staff who are currently checked in (have check-in but no check-out today) AND have location tracking enabled
- Fetches their push subscriptions from the database
- Sends a push notification to each one with the reminder message
- Cleans up any expired/invalid subscriptions

### Step 6: Scheduled Job (Every 30 Minutes)

Set up a database cron job that calls the `send-tracking-reminder` function every 30 minutes automatically. This runs in the background without any manual intervention.

---

## Technical Details

### New Files
- `public/custom-sw.js` -- Service worker that handles push notification display and click
- `src/hooks/use-push-notifications.ts` -- Hook to manage push subscription lifecycle
- `supabase/functions/send-tracking-reminder/index.ts` -- Backend function to send push notifications

### Modified Files
- `vite.config.ts` -- Configure PWA plugin to inject the custom service worker
- `src/pages/MarkAttendance.tsx` -- Trigger notification permission request on check-in
- `supabase/config.toml` -- Register the new backend function (no JWT verification since it's called by cron)

### Database Changes
- New `push_subscriptions` table with RLS policies
- New cron job: runs every 30 minutes calling the send-tracking-reminder function

### Secrets Required
- `VAPID_PUBLIC_KEY` -- Public key for push subscription (also embedded in frontend)
- `VAPID_PRIVATE_KEY` -- Private key for signing push messages
- `VAPID_SUBJECT` -- Contact email for VAPID (e.g., mailto:admin@abras.com)

### Important Notes
- Push notifications work on Android and most desktop browsers immediately
- On iPhone (iOS), push notifications work only if the app is installed to the home screen (which your /get-abras page already guides staff to do)
- Staff will see a one-time browser prompt asking to allow notifications when they first check in
- If a staff member denies notification permission, everything else still works normally -- they just won't get the reminders

