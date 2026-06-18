# Glintvex website

Marketing site for Glintvex (SaaS & FinTech engineering studio) plus a small
zero-dependency backend that captures leads, whitepaper subscribers, and demo
bookings, and emails calendar invites.

## Run

```bash
npm install        # installs nodemailer + puppeteer-core (dev)
npm start          # serves the site + API at http://127.0.0.1:8099
```

Open http://127.0.0.1:8099.

## Where submissions go

Every submission is **always saved to disk** (the permanent record), whether or
not email is configured:

| File | Source |
|------|--------|
| `data/leads.json` | "Send us a line" project enquiries |
| `data/subscribers.json` | Whitepaper subscribers (footer) |
| `data/bookings.json` | Demo bookings (date, time, name, email, notes, ref) |

## Email notifications

Notifications about new leads/subscribers/bookings are sent to the inbox set in
`MAIL_TO`. Demo bookings also send the visitor a confirmation with an `.ics`
calendar invite attached.

1. Copy the config and set your inbox + SMTP credentials:
   ```bash
   cp .env.example .env   # (a .env already exists with MAIL_TO preset)
   ```
2. Set in `.env`:
   - `MAIL_TO` — the inbox where **you** receive every lead and booking.
   - `MAIL_FROM` — the "from" address on outgoing mail.
   - `SMTP_URL` — your SMTP provider connection string (see `.env.example`).

**Until `SMTP_URL` is set**, nothing is emailed — instead every notification is
appended to `data/outbox.log` so you never lose a lead. The raw data files above
are written regardless.

## API

| Method | Path | Body | Purpose |
|--------|------|------|---------|
| POST | `/api/lead` | `{email, message}` | Project enquiry |
| POST | `/api/subscribe` | `{email}` | Whitepaper subscribe |
| GET  | `/api/availability?from=&to=` | – | Booked slots in range |
| POST | `/api/book` | `{name, email, date, time, notes}` | Book a demo |

Bookings are weekdays only, future-dated within 90 days, 10:00–16:00 GST, and
double-booking is prevented server-side.

## Verification

`npm run screenshots` (with the server running) captures responsive screenshots
and runs interactivity checks via headless Chrome into `/tmp/glintvex_shots`.
