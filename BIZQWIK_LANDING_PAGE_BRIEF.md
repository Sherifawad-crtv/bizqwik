# Bizqwik — Landing Page Brief (v1)

One page. Sells the ecosystem first, then the plans, then asks the visitor to talk to us.
This file is the full content, structure, copy and visual direction. Everything marked **FINAL** is decided: do not reword, reprice or reorder it. Anything marked **GAP** is not decided yet and is collected in section 14.

Source of truth for product facts: `BIZQWIK_DECK_BRIEF.md` and the 15-slide deck in `deck/` (same repo). If this brief and the deck ever disagree, tell Sherif. Do not pick one.

---

## 1. Goal

**What the page must do:** make a gym, studio or club owner understand in under a minute that Bizqwik runs the whole business through five connected apps, see what it costs, and contact us.

**The single conversion:** *Talk to us.* v1 has no sign-up, no checkout and no booking widget. The action is a phone call or an email.

| | |
|---|---|
| Primary CTA | **Talk to us** (scrolls to contact; on mobile also offers tap-to-call) |
| Secondary CTA | **See plans** (scrolls to plans) |
| Contact | Phone **01000401407** · Email **info@bizqwik.com** |
| Language | English only in v1 |
| Currency | EGP |
| Audience | Owners and managers of gyms, studios and clubs in Egypt: boutique gyms, studios, PT-led gyms, clubs |

**Success looks like** (measure, no targets invented): clicks on call, clicks on email, clicks on "Talk to us", plan sections viewed, scroll depth to Plans and to Contact.

**Out of scope for v1:** blog, login, sign-up, contact form, live chat, Arabic version, case studies, testimonials, customer logos, demo videos, pricing calculator.

---

## 2. Voice and copy rules

**Voice:** simple, confident, commercial. Plain words. Short sentences. No jargon. No hype.

**Do**
- Lead with what the owner gets, then how.
- Use the owner's words: *clients, coaches, front desk, payouts, memberships, class bundles*.
- Keep numbers exact and tabular (1,290 not "about 1.3k").
- Say "your gym" in body copy. "Community" is used in the headline and the closing line only.

**Don't** (hard rules, same as the deck brief)
1. Never change prices, plan names, limits or feature wording in section 6 and 8.
2. Never show a price for Enterprise. It is **Contact us**.
3. Never put prices on add-ons.
4. Never show yearly pricing, discounts, launch offers, "most popular" badges or "coming soon" labels. The only highlight in the whole page is **Best fit for studios** on Grow.
5. Never claim anything that is not in this file: no statistics, no "trusted by", no testimonials, no speed or savings claims, no uptime or security claims, no free trial or demo (not decided, see GAP list).
6. Never invent customers, logos or quotes. The three brands shown in the client app section are labelled **illustrative**.
7. Branding is a client-app feature. Do not say the whole product is white-labelled or "under your brand". Only the client app carries the gym's brand.
8. Plan names are exactly: **Solopreneur, Grow, Scale, Enterprise**.
9. Prices always read "EGP / month", with "excluding 14% VAT" stated on the plans section and again on the compare table.

---

## 3. Brand and visual system

Warm, friendly, approachable. It must not feel like an enterprise admin panel. Group with space and soft elevation, not hard borders. No cards inside cards. No cold pure white.

### 3.1 Logo
- Files: `deck/assets/logo.webp` (wordmark + B), `deck/assets/mark.png` (B emblem only). Use exactly as supplied. Never redraw, recolour, stretch or add effects.
- Light backgrounds only (Paper or Surface). The wordmark is dark ink and disappears on dark or violet. If a dark section is wanted, **GAP**: a reversed logo is needed.
- Clear space: at least the height of the "b" mark on all sides.
- The emblem alone is used as the hub in the closing visual and as the favicon source.

### 3.2 Colour tokens

| Token | Hex | Use |
|---|---|---|
| Paper | `#F3F2EE` | Page background |
| Surface | `#FBFAF7` | Cards (never pure white) |
| Sunken | `#ECEBE5` | Wells, tags, selector background |
| Line | `#E3E1DA` | Hairlines |
| Ink | `#1A1726` | Main text |
| Ink muted | `#6C687A` | Secondary text |
| Ink faint | `#9A96A6` | Decorative only (see contrast) |
| **Primary violet** | `#5A41FF` | Key numbers, highlighted plan, primary actions |
| Primary pressed | `#4832D6` | Hover/pressed, small violet text |
| Primary tint | `rgba(90,65,255,0.10)` | Icon tiles, soft containers |
| Amber | text `#946200` on `#F6E7C4` | Tags ("Scale plan only") |
| Green | text `#177A4B` on `#D8EFE0` | Done / included ticks |
| Mark gradient | `linear-gradient(135deg,#7B5CFF,#4A2FE0)` | Emblem only |

Use violet sparingly. Large soft violet washes (5–7% opacity radial) sit behind sections for depth.

**Contrast (computed)**
| Pair | Ratio | Rule |
|---|---|---|
| Ink on Paper | 15.7 | Body |
| Violet on Paper | 5.2 | OK for text 18px+ and UI |
| Pressed on Paper | 6.9 | Use for small violet text and links |
| Muted on Paper | 4.8 | OK for body-size secondary text |
| White on Violet | 5.8 | Grow card, primary button |
| Faint on Paper | 2.6 | **Decoration only.** Never for text that must be read |
| Amber / Green tags | 4.3 / 4.4 | Large or bold tag text only, or darken the text one step |

### 3.3 Typography (Google Fonts, self-host the files)
- **Urbanist** 500 / 600 / 700 / 800: all headlines, names, prices, body. Headlines 800 with tracking −2% to −3.5%. Prices and key numbers: 800 with tabular figures.
- **Space Mono** 400 / 700: small uppercase labels, units, captions, eyebrows only. Never for sentences or buttons.
- Scale (desktop → mobile): H1 96–104 → 44; H2 80–96 → 36; H3 28–34 → 22; body 20–26 → 17–18; label 13–16 → 12.

### 3.4 Shape and elevation
- Radius: cards 28–32, buttons 24, inputs 20, small tiles 16–20, pills and avatars fully round.
- Card shadow: `0 1px 2px rgba(26,23,38,.04), 0 8px 24px -12px rgba(26,23,38,.10)`.
- Grow card only: filled violet (subtle gradient `160deg #6A52FF → #5A41FF → #4C34E6`), white text, soft violet glow shadow.
- A floating pill with a separate round action button is part of the product's look: use it for the sticky nav (pill) and the call button.

### 3.5 Icons
Solar icon set (the same set the apps use), **Linear** weight, 1.7 stroke, violet on a soft violet tile. One icon per app, reused everywhere:

| App | Icon |
|---|---|
| Founder / C-suite | `chart-square` |
| Accountant | `calculator` |
| Front desk | `qr-code` |
| Coaches | `users-group-two-rounded` |
| Client | `smartphone` |

Add-on icons: `smartphone`, `smartphone-update`, `stars`, `cpu-bolt`, `buildings`, `map-point-add`, `user-plus`, `chat-round-dots`. Contact: `phone-calling-rounded`, `letter`. Ticks: `check-circle`. Library is MIT licensed; no attribution required, keep the licence file in the repo.

### 3.6 Device mockups and screens
- Frames: `deck/assets/frame-phone.webp`, `deck/assets/frame-tablet.webp`. Use exactly as supplied. Never recolour, crop or add effects.
- Screens inside frames are **real screenshots from the real apps** running on demo data (`deck/assets/shots/`). The scripts that regenerate them are in `deck/screenshot-specs/`.
- Phone screens carry an iOS status bar (9:41, signal, wifi, battery) and are clipped to the frame's rounded corners. Tablet screens are clipped the same way.
- Device pairing: phone for client, coaches and front-desk home; tablet for founder, accountant and front-desk calendar.
- Do not draw stand-in UI. Do not use real client data.

| Slot | File | Shows |
|---|---|---|
| Hero tablet | `founder-oversight.png` | Founder overview, 587,400 EGP revenue, 12-month chart |
| Hero phone | `client-pulse.png` | Client home in Bizqwik violet |
| Founder | `founder-oversight.png` | Overview dashboard |
| Accountant | `accountant-pay.png` | To Pay, payout queue |
| Front desk | `desk-calendar.png` (tablet) + `desk-home.png` (phone) | Class calendar (week view), home |
| Coaches | `coach-home.png` | My month |
| Client brands | `client-forge.png`, `client-grove.png`, `client-pulse.png` | Same screen, three illustrative brands |

**GAP:** the demo screens contain invented names and numbers ("Karim Founder", "Coach Nour", 587,400 EGP) and stand-in class photos. Replace with approved demo content before launch. The founder screen shows the role label "Department Head" (the app's own role name) while the page calls it Founder / C-suite.

### 3.7 Layout
- Desktop design width 1440, content max-width 1280, 12-column grid, 28–32px gutters.
- Section padding: 120px top and bottom desktop, 72px mobile. One idea per section.
- Mobile: single column, 16–20px side gutters, no horizontal page scroll. Devices stack above or below copy and scale to 80–90% of width.
- Sticky nav pill, 56px high, Surface background, soft shadow.

### 3.8 Motion
Restrained. Fade and rise on scroll (16px, 300–400ms, ease-out), staggered by 60ms for tile rows. Device mockups settle in (opacity and 12px translate only). No parallax, no autoplay video, no looping animation. Respect `prefers-reduced-motion` (no movement, instant states).

---

## 4. Page architecture

Single page, anchored sections, in this order:

| # | Section | Anchor | Purpose |
|---|---|---|---|
| 0 | Header | — | Orient, jump, convert |
| 1 | Hero | `#top` | The promise |
| 2 | Ecosystem | `#ecosystem` | Five apps, one system |
| 3 | The apps (5 blocks) | `#apps` | What each person gets |
| 4 | Branded client app | `#client-app` | Your gym's own brand, where clients see it |
| 5 | Plans | `#plans` | Find your plan, see the price |
| 6 | Compare | `#compare` | Side by side for deciding |
| 7 | Add-ons | `#add-ons` | Add what you need |
| 8 | FAQ | `#faq` | Remove the last doubts |
| 9 | Contact | `#contact` | Talk to us |
| 10 | Footer | — | Contact, legal |

Nav items (in order): **The apps · Plans · Add-ons · FAQ**, then the **Talk to us** button. Logo links to `#top`.

---

## 5. Section copy and specs

### 0. Header
- Left: logo. Centre: nav pill (The apps · Plans · Add-ons · FAQ). Right: round **Talk to us** button (violet, white text).
- Mobile: logo + round call button + menu button. Menu opens a full-width sheet with the same four links and both contact actions.
- On scroll the nav becomes a floating pill with a soft shadow.

### 1. Hero  `#top`

**Eyebrow (Space Mono):** FOR GYMS, STUDIOS AND CLUBS

**H1 (FINAL):** One ecosystem. Your whole community.
- "community." gets a soft violet highlighter underline (tint at 24%), not a colour change.

**Support line (FINAL):** Founder, accountant, front desk, coaches and clients, all in sync.

**CTAs:** [Talk to us] primary · [See plans] secondary (ghost, Surface).

**Proof strip under the CTAs:** the five app icon tiles in a row, then mono label: FIVE APPS · ONE ECOSYSTEM.
**Fine print (mono, muted):** Plans in EGP, billed monthly.

> "billed monthly" is safe: every plan has one monthly price. Do not add "cancel anytime" or any term we have not decided.

**Visual:** founder tablet (`founder-oversight.png`) with the client phone (`client-pulse.png`) overlapping its lower right, on a soft violet circle. Desktop: copy left, art right. Mobile: copy first, art below, tablet at 100% width, phone overlapping by 24%.

**Alt text:** "Bizqwik founder dashboard on a tablet and the branded client app on a phone."

### 2. Ecosystem  `#ecosystem`

**H2 (FINAL):** Five apps. One system.
**Lede:** Everyone who touches your gym gets their own app, and every app stays in sync.

Five tiles in a row with small arrow connectors between them (desktop). Mobile: vertical stack, connector arrows point down.

| # | Tile title | Role line (FINAL) | Used by |
|---|---|---|---|
| 01 | Founder / C-suite app | Sets prices, schedules and the team | Gym owner, department head |
| 02 | Accountant dashboard | Runs the monthly payout | Accountant |
| 03 | Front-desk / reception app | Checks clients in and takes payments | Front desk |
| 04 | Coaches app | Logs sessions and tracks earnings | Coaches |
| 05 | Branded client app | Books, buys and checks in | The gym's clients |

Each tile links to its block in section 3.

### 3. The apps  `#apps`

Five alternating blocks (copy left / device right, then reversed on desktop; always copy then device on mobile). Each block has:
- a five-icon mini navigator (current app filled violet) at the block top
- eyebrow: `APP n · <app name>` plus a "Used by" chip
- a headline (the message)
- bullets (the feature list, **wording FINAL**, lead-in before the colon in bold)
- the device(s) with a small mono caption

Bullets use the `check-circle` icon in violet. Highlighted bullets (soft tint background) are marked ★.

#### 3.1 Founder / C-suite app
- Eyebrow: APP 1 · FOUNDER / C-SUITE APP · Used by: Gym owner, department head
- **Headline:** See the whole business. Run it from one place.
- Bullets:
  - See revenue, profit, coach payouts and active subscribers in one dashboard.
  - Set prices, memberships, bundles and class schedules.
  - **Manage the team:** invite staff, give each a role, assign coach tiers and rates.
  - Set personal training packages and each tier's cut.
  - Review and approve sessions and InstaPay receipts.
  - **Staff attendance:** see who attended and exactly when, with timestamps, and who was late or on time against the assigned session time.
  - Brand your client app in minutes.
  - Run several departments and locations, each with its own prices, coaches and sessions. `SCALE PLAN ONLY` (amber tag)
- Device: tablet, `founder-oversight.png`. Caption: FOUNDER DASHBOARD · OVERVIEW.

#### 3.2 Accountant dashboard
- Eyebrow: APP 2 · ACCOUNTANT DASHBOARD · Used by: Accountant
- **Headline:** From coach earnings to paid, with a clear record.
- Bullets:
  - See revenue and each coach's earnings for the month.
  - **Run the monthly payout:** settle, pay, mark paid.
  - Keep a clear record of what was paid and when.
- Device: tablet, `accountant-pay.png`. Caption: ACCOUNTANT DASHBOARD · TO PAY.

#### 3.3 Front-desk / reception app
- Eyebrow: APP 3 · FRONT-DESK / RECEPTION APP · Used by: Front desk
- **Headline:** Check-in, sales and bookings, all at the desk.
- Bullets:
  - Check clients in by QR code.
  - Sell memberships, bundles and drop-in passes.
  - **Take payments:** cash, card, wallet or InstaPay.
  - Book clients into classes and see who is coming.
  - Freeze a client's membership.
- Devices: tablet `desk-calendar.png` (class calendar, week view) with phone `desk-home.png` overlapping its right edge. Caption: CLASS CALENDAR (WEEK VIEW) · HOME.

#### 3.4 Coaches app
- Eyebrow: APP 4 · COACHES APP · Used by: Coaches
- **Headline:** Sessions, schedules and earnings, in one app.
- Tier pills under the headline: **Junior coach · Senior coach · Head coach** (Head coach filled).
- Bullets:
  - Log sessions by scanning a QR in the coaches' room.
  - See what you've earned this month at your tier's rate.
  - Deliver personal training sessions by scanning the client's PT code.
  - ★ **Monthly scheduling:** the head coach sets the whole month up front, with dates and start times, and assigns classes to coaches.
  - **Attendance on your assigned date only:** a coach can't log a session outside their assigned slot.
  - ★ **Hand over a session:** a coach can assign or request a swap with another coach, at least 2 hours before the session, and only if the other coach accepts.
  - **Head coach:** review and edit sessions and handle settlements.
- Device: phone, `coach-home.png`. Caption: COACHES APP · MY MONTH.

#### 3.5 Branded client app  `#client-app`
- Eyebrow: APP 5 · BRANDED CLIENT APP · Used by: The gym's clients
- **Headline:** Your gym in your clients' pockets, under your brand.
- Bullets:
  - Your gym's own name, logo, colours and web address.
  - Check in with a QR code.
  - Book classes and say "I'm coming".
  - Buy memberships and bundles.
  - Top up a wallet and earn loyalty points.
  - Freeze your own plan.
- Callout (soft violet tile, bold): **This is the app that carries your gym's own brand.**
- Devices: three phones, same screen, three brands: Forge Athletics (black), Grove Pilates (olive on beige), Pulse Studio (Bizqwik violet). Middle phone sits higher. Mono labels under each. Caption: SAME APP, THREE ILLUSTRATIVE GYM BRANDS.
- Mobile: horizontal scroll-snap row of the three phones, or the middle phone only with a "See other brands" dot control.

### 5. Plans  `#plans`

**H2 (FINAL):** Four plans. One monthly price each.
**Lede:** Start small. Move up as you grow.

**Cards (equal width, desktop 4 across, tablet 2×2, mobile stacked in plan order):**

| | **Solopreneur** | **Grow** | **Scale** | **Enterprise** |
|---|---|---|---|---|
| Tag | — | **Best fit for studios** (flag on top edge) | — | — |
| For | Independent coaches and solo studios | Studios and gyms with a team | Clubs with several departments | Large or multi-site communities |
| Price | **1,290** EGP / month | **4,990** EGP / month | **14,990** EGP / month | **Contact us** |
| Active clients included | 60 | 300 | 1,500 | Custom |
| Each extra client | 25 EGP | 20 EGP | 12 EGP | Custom |

- Grow is the only violet-filled card. The others are Surface with a hairline.
- Each card ends with a text link: **See what's included** → opens that plan's detail panel (below). Enterprise's link: **Contact us**.

**Callout under the cards (FINAL):** ★ **Extra clients never cost more than the next plan.** If extra-client charges would pass the next plan's price, you simply move up.

**VAT note (mono, FINAL):** ALL PRICES ARE EGP PER MONTH, EXCLUDING 14% VAT. VAT IS ADDED ON THE INVOICE.

#### Plan detail panels (accordion on mobile, tabs on desktop: Solopreneur · Grow · Scale · Enterprise)

Each panel has: plan name, one-line summary, the five apps (included lit, others dimmed), capacity, experience, and a "next plan" pointer.

| | Solopreneur | Grow | Scale | Enterprise |
|---|---|---|---|---|
| **Summary line** | The founder app and a branded booking page. | All five apps, with a branded client app (PWA). | Several departments, 2–3 locations and a native app on the app stores. | Everything is custom, built around your community. |
| Founder / C-suite app | ✓ | ✓ | ✓ (per department) | Custom |
| Accountant dashboard | — | ✓ | ✓ | Custom |
| Front-desk / reception app | — | ✓ | ✓ | Custom |
| Coaches app (junior, senior, head) | — | ✓ | ✓ | Custom |
| Branded client app | Branded booking page | Branded client app (PWA) | Native app on the app stores | Custom |
| Active clients included | 60 | 300 | 1,500 | Custom |
| Each extra client | 25 EGP | 20 EGP | 12 EGP | Custom |
| Staff | 1 | 10 | 5 per department | Custom |
| Departments | 1 | 1 | 5 | Custom |
| Locations | 1 | 1 | 2–3 | Custom |
| Physical integrations (e.g. gate access) | — | — | Included | Custom |
| **Next plan pointer** | Grow · 4,990 EGP / month · 300 clients, 10 staff and all five apps | Scale · 14,990 EGP / month · 1,500 clients, 5 departments and a native app on the app stores | Enterprise · Contact us · For large or multi-site communities | Let's talk · Contact us to set yours up. |

Rules for the panels:
- Solopreneur: the founder app is a single-role app. The name carries that meaning; do not add the "single-role" caption (removed on purpose).
- Enterprise gets its own treatment, not the shared template: a dark ink panel (name, "Large or multi-site communities", **Contact us**, "Everything is custom, built around your community.") beside a spacious numbered list headed **Every part of the plan is set around you.** with the line "Large or multi-site communities get all of these tailored." The list (each item once, no repeated "Custom"): 01 Active clients included · 02 Each extra client · 03 Staff · 04 Departments · 05 Locations · 06 Apps included · 07 Client experience · 08 Physical integrations (e.g. gate access).
- Never show a number on Enterprise.

### 6. Compare  `#compare`

**H2 (FINAL):** Every plan, side by side.

A table in one Surface card, hairline rows, three labelled groups: **PRICE AND CAPACITY**, **EXPERIENCE**, **APPS INCLUDED**. Same data as the plan panels. Header row: Solopreneur · Grow · Scale · Enterprise (no extra highlight on Grow here).

- PRICE AND CAPACITY: Price (EGP / month) 1,290 · 4,990 · 14,990 · Contact us. For. Active clients included. Each extra client. Staff. Departments. Locations.
- EXPERIENCE: Client experience. Physical integrations (e.g. gate access).
- APPS INCLUDED: Founder / C-suite app (✓, ✓, ✓ per department, Custom) · Accountant dashboard · Front-desk / reception app · Coaches app (junior, senior, head) · Branded client app (Booking page · PWA · Native app on the stores · Custom).

**Footer of the card (FINAL):**
- ALL PRICES ARE EGP PER MONTH, EXCLUDING 14% VAT.
- **In every plan:** memberships and class bundles (monthly, 3-month, annual, class passes), freezing a membership, class schedule and booking, payment tracking (cash, card, wallet, InstaPay with receipt approval), revenue dashboard, your own branding on the client experience.

Mobile: collapse to a plan switcher (segmented control) showing one plan's column at a time, with the row labels fixed. Do not squeeze four columns onto a phone.

### 7. Add-ons  `#add-ons`

**H2 (FINAL):** Add what you need.
**Lede:** Start with your plan. Add more whenever your gym needs it.

Four grouped panels (12-col grid: Client app 6, AI 6, Team and sites 8, Messaging 4). **No prices. No plan labels. No "coming soon".**

| Group | Add-on | Line (FINAL) |
|---|---|---|
| Client app | Branded native app on the app stores | Your own app in the App Store and Google Play, under your name |
| Client app | Branded client app (PWA) | Your own installable app for clients, for plans that don't include it |
| AI | AI assistant | Ask questions about your gym in plain language and get answers and analysis |
| AI | AI agent | An assistant that does tasks for you inside the app, not just answers |
| Team and sites | Extra department | Add another department with its own prices, coaches and sessions |
| Team and sites | Extra location | Add another branch |
| Team and sites | Extra staff member | Add more team seats |
| Messaging | WhatsApp / SMS messages | Send reminders, renewals and announcements to clients |

Under the panels (small, muted): **Want to add something? Talk to us.** (links to `#contact`).

### 8. FAQ  `#faq`

**H2:** Questions owners ask.
Accordion, one open at a time, first item open by default. Answers use only facts in this brief.

1. **How does pricing work?**
   Each plan has one monthly price in EGP, excluding 14% VAT. VAT is added on the invoice. Enterprise is priced on request.
2. **What if I have more clients than my plan includes?**
   Every extra active client is charged at your plan's rate: 25 EGP on Solopreneur, 20 EGP on Grow, 12 EGP on Scale. Extra clients never cost more than the next plan. If the extra-client charges would pass the next plan's price, you simply move up.
3. **Which plan is right for me?**
   Solopreneur is for independent coaches and solo studios. Grow is for studios and gyms with a team, and is our best fit for studios. Scale is for clubs with several departments. Enterprise is for large or multi-site communities. [See plans]
4. **What do my clients get?**
   A client experience under your brand: your gym's own name, logo, colours and web address. On Solopreneur it is a branded booking page. On Grow it is a branded client app (PWA). On Scale it is a native app on the app stores. Clients check in with a QR code, book classes, buy memberships and bundles, top up a wallet, earn loyalty points and freeze their own plan.
5. **How do clients pay?**
   Bizqwik tracks cash, card, wallet and InstaPay payments. InstaPay receipts are reviewed and approved by you. The front desk can take payments at the desk.
6. **How are coaches paid?**
   You set coach tiers and rates. Coaches log their sessions by scanning a QR in the coaches' room. At month end your accountant settles the month, pays each coach and marks it paid, with a clear record of what was paid and when.
7. **Can I run more than one department or location?**
   Yes, on Scale: up to 5 departments and 2–3 locations, each department with its own prices, coaches and sessions. You can also add an extra department or location to a plan as an add-on. Enterprise is custom.
8. **Can I add things later?**
   Yes. Add-ons include a native app on the app stores, a branded client app (PWA), an AI assistant, an AI agent, extra departments, extra locations, extra staff and WhatsApp / SMS messages. [See add-ons]
9. **Who uses each app?**
   The founder app is for the gym owner and department heads. The accountant dashboard is for your accountant. The front-desk app is for reception. The coaches app is for junior, senior and head coaches. The branded client app is for your clients.
10. **How do I get started?**
    Call us on 01000401407 or email info@bizqwik.com and we'll set up your gym. [Talk to us]

> Do **not** add FAQs about trials, demos, contracts, data security, uptime, migration, cancellation or support hours. None of that is decided (see GAP list).

### 9. Contact  `#contact`

Full-width Paper section with the closing visual. This is the page's final push.

**H2 (FINAL):** Let's set up your gym.
**Lede (FINAL):** One ecosystem. Your whole community.

Two contact cards (Surface, side by side on desktop, stacked on mobile), each with a violet icon tile:

| Card | Label (mono) | Value | Action |
|---|---|---|---|
| Phone | PHONE | **01000401407** | `tel:+201000401407` (confirm number format) |
| Email | EMAIL | **info@bizqwik.com** | `mailto:info@bizqwik.com?subject=Set%20up%20my%20gym` |

**Visual (desktop right):** the B emblem in a round Surface hub at the centre, the five app icon tiles evenly spaced on a thin violet-tint orbit ring around it. Mobile: the same, scaled to 320px, above the contact cards.

No form in v1. Do not add one without a decision on where submissions go.

### 10. Footer
- Left: logo. Under it: © Bizqwik and the year. **GAP:** legal entity name.
- Centre: nav links repeated (The apps · Plans · Add-ons · FAQ).
- Right: phone and email (same actions as section 9).
- Legal links (Privacy, Terms): **GAP**, no documents exist yet. Do not ship dead links.

---

## 6. Microcopy

| Element | Copy |
|---|---|
| Primary button | Talk to us |
| Secondary button | See plans |
| Plan link | See what's included |
| Enterprise link | Contact us |
| Add-ons link | Want to add something? Talk to us. |
| Mobile call button (aria-label) | Call Bizqwik |
| Nav menu button (aria-label) | Open menu |
| Copy-on-click toast (phone or email) | Copied |
| Pill "best fit" | Best fit for studios |
| Included / not included (plan tiles) | Included · Not included |
| Skip link | Skip to content |
| 404 (if the host serves one) | This page isn't here. Back to Bizqwik. |

---

## 7. SEO and sharing

- **Title (≤ 60 chars):** `Bizqwik | One ecosystem. Your whole community.`
- **Meta description (≤ 155 chars):** `Five connected apps run your gym: founder, accountant, front desk, coaches and a branded client app. Plans from 1,290 EGP a month.`
- **H1:** the hero headline. Exactly one H1. Sections use H2; app and plan names use H3.
- **Open Graph / Twitter:** title and description above; image 1200×630: the hero composition on Paper with the logo (build from the hero assets). Card type `summary_large_image`.
- **Favicon / app icon:** from `deck/assets/mark.png`. The client app repo already has `public/favicon-*.png`, `icon-192.png`, `icon-512.png` and `apple-touch-icon.png` if reuse is wanted.
- **Structured data (JSON-LD):** `Organization` (name Bizqwik, email, telephone, logo) and `SoftwareApplication` with three `Offer`s (1290, 4990, 14990, `priceCurrency: EGP`, monthly; note VAT is excluded in the description). **No Offer for Enterprise.** No `aggregateRating`, no `review`.
- `lang="en"`, canonical URL (**GAP:** domain), `robots` index/follow.
- Keywords are not a meta tag. Natural phrases to appear in copy: gym management software, gym app, class booking, memberships, coach payouts, front desk, client app, Egypt. Do not stuff.

---

## 8. Content inventory (single source of facts)

**Five apps and who uses them**
1. Founder / C-suite app: gym owner, department head
2. Accountant dashboard: accountant
3. Front-desk / reception app: front desk
4. Coaches app (junior, senior, head coach): coaches
5. Branded client app: the gym's clients

**Features in every plan:** memberships and class bundles (monthly, 3-month, annual, class passes), freezing a membership, class schedule and booking, payment tracking (cash, card, wallet, InstaPay with receipt approval), revenue dashboard, your own branding on the client experience.

**Only limited to one plan:** departments and locations (Scale), physical integrations (Scale), native app on the stores (Scale).

**Pricing:** per month, EGP, excluding 14% VAT (added on the invoice). One monthly price per plan. No yearly price, no annual discount, no launch discount.

**The rule to state on the page:** extra clients never cost more than the next plan.

---

## 9. Components

| Component | Notes |
|---|---|
| Nav pill | Surface, soft shadow, sticky; active section gets Sunken pill |
| Button primary | Violet, white text, radius 24, 56px high; hover → Pressed; focus ring 3px violet at 40% |
| Button secondary | Surface, ink text, soft shadow |
| Icon tile | 52–92px, radius 16–26, Primary tint, violet Solar icon |
| Mini navigator | Five 46px round tiles; current one violet fill, white icon |
| Chip / tag | Space Mono 13–14px uppercase; Sunken, tint or amber |
| Feature list | `check-circle` violet 32px, text 22–25px, lead-in bold, ★ rows on a tint background |
| Plan card | Surface; Grow violet gradient; flag pill on Grow's top edge |
| Plan tabs / accordion | Segmented control (Sunken track, Surface active pill) on desktop; accordion on mobile |
| Compare table | One Surface card; group labels in violet mono; hairlines; sticky header on desktop |
| Add-on panel | Surface; group label with a small violet dot; items separated by hairlines |
| FAQ accordion | Hairline separators; plus/minus icon; 200ms height ease |
| Contact card | Surface; 64px icon tile; mono label; 34px value |
| Device | Frame image over a clipped screen; screenshot top-aligned; never scaled non-uniformly |

---

## 10. Responsive behaviour

| Breakpoint | Behaviour |
|---|---|
| ≥ 1280 | Full layouts as specified |
| 1024–1279 | Hero art scales to 85%; plan cards 2×2; ecosystem tiles 5 across with smaller type |
| 768–1023 | Two-column app blocks collapse to one; devices centred; compare card scrolls inside itself |
| < 768 | Single column; nav collapses; plan cards stack; compare becomes a plan switcher; add-on panels stack with items separated by hairlines; contact cards stack; sticky bottom bar with **Call** and **Email** (hides at the contact section) |

Touch targets ≥ 44px. No horizontal page scroll at any width. Test 360, 390, 430, 768, 1024, 1280, 1440, 1920.

---

## 11. Accessibility

- WCAG 2.2 AA. Follow the contrast table in 3.2.
- Semantic landmarks: `header`, `nav`, `main`, `section` with `aria-labelledby`, `footer`.
- Every device image has meaningful alt text describing the screen (e.g. "Accountant dashboard showing the monthly payout queue"). Decorative washes and icon tiles are `aria-hidden`.
- The compare table is a real `<table>` with `scope` attributes; group rows use `<tbody>` headings or `th scope="rowgroup"`.
- Accordions and tabs follow ARIA authoring patterns, fully keyboard operable.
- Visible focus on every control. Skip link first in the tab order.
- Phone and email are real `tel:` and `mailto:` links with the number and address as visible text (no icon-only links).
- Reduced motion respected (section 3.8).

---

## 12. Tech and delivery notes

- Static page. Any modern static stack is fine (Vite or Next, static export), deployed on Vercel (same as the rest of the Bizqwik stack). No backend, no CMS, no cookies in v1.
- Fonts self-hosted (Urbanist, Space Mono), `font-display: swap`, preload the two most-used files.
- Images: export screenshots as AVIF/WebP at 2× display size with PNG fallback; frames as WebP. Lazy-load everything below the hero; give every image width and height to prevent layout shift. Target Lighthouse ≥ 95 performance, ≥ 95 accessibility on mobile.
- Analytics: privacy-friendly, no cookie banner needed (**GAP:** tool choice). Events: `cta_talk_to_us` (with section), `click_phone`, `click_email`, `plan_opened` (plan name), `compare_viewed`, `faq_opened` (question number), `addons_viewed`.
- Assets to carry over from `deck/assets/`: `logo.webp`, `mark.png`, `frame-phone.webp`, `frame-tablet.webp`, `shots/*.png`, `fonts/`. Icons: generate SVGs from `@solar-icons/react` (script `deck/gen-icons.mjs` shows how).
- The deck's `build.py` / `deck.css` are a working reference for spacing, tiles, plan cards, the compare table and the contact cards. Match the look; do not copy the slide-size absolute positioning.

---

## 13. QA checklist (all must pass before launch)

**Content**
- [ ] Prices read 1,290 / 4,990 / 14,990 EGP per month; Enterprise shows "Contact us" and no number anywhere (including meta, JSON-LD and alt text).
- [ ] Plan names are Solopreneur, Grow, Scale, Enterprise everywhere.
- [ ] Limits match section 5 exactly (60 / 300 / 1,500; 25 / 20 / 12 EGP; staff 1 / 10 / 5 per department; departments 1 / 1 / 5; locations 1 / 1 / 2–3).
- [ ] "Best fit for studios" appears only on Grow. No other badge, highlight, discount, yearly price or "coming soon".
- [ ] "Excluding 14% VAT" appears in Plans and in Compare.
- [ ] Add-ons have no prices.
- [ ] No claim exists that is not in this brief. No stats, testimonials, customer logos, trial or demo.
- [ ] Only the client app is described as carrying the gym's brand.
- [ ] Phone and email are correct and tappable.

**Design**
- [ ] No Pure white, no hard black borders, no cards inside cards.
- [ ] Violet used only for key numbers, the Grow card, primary actions and icons.
- [ ] Logo used as supplied, on light backgrounds only, with clear space.
- [ ] Devices unmodified; screens clipped to the frame corners; phone screens have the status bar.
- [ ] Three client-app brands are labelled illustrative.

**Quality**
- [ ] No horizontal scroll 360–1920. No layout shift. Reduced-motion verified. Keyboard-only run-through works. Screen-reader pass on nav, accordions, tabs and table.
- [ ] Lighthouse mobile ≥ 95 (performance, accessibility, best practices, SEO).

---

## 14. Open questions and gaps (need Sherif)

1. **Domain and canonical URL.** Which domain will serve the page?
2. **Phone format and WhatsApp.** Is 01000401407 also on WhatsApp? Confirm the `tel:` format (`+201000401407`). Do not add a WhatsApp button until confirmed.
3. **Legal.** Legal entity name for the footer; Privacy and Terms documents (or decide to ship without links).
4. **Trial / demo / onboarding.** Not decided, so the page makes no promise. If a demo or a free trial exists, the primary CTA and FAQ should change.
5. **App login.** Is there a "Log in" for existing gyms (and where do the apps live)? v1 assumes none.
6. **Reversed logo.** Needed only if any dark section is wanted.
7. **Demo content.** Approved names, numbers and class photos for the app screens (current ones are stand-ins). Decide whether the founder screen's "Department Head" label should be renamed to Founder in the app.
8. **Renamed plan.** "Start" became **Solopreneur** in the deck. Confirm it is the final public name and update any other material.
9. **Social links and company address.** None provided; none shown.
10. **Analytics tool.**
11. **Arabic.** Planned later? If yes, build the layout with RTL in mind (logical CSS properties, mirrored arrows and orbit order).
12. **FAQ sign-off.** Confirm answers 5, 6 and 9 describe the apps accurately (they are written from the feature lists, in plain words).

---

## 15. Final copy deck (read-only, for quick review)

**Hero** — Eyebrow: FOR GYMS, STUDIOS AND CLUBS. **One ecosystem. Your whole community.** Founder, accountant, front desk, coaches and clients, all in sync. [Talk to us] [See plans]. FIVE APPS · ONE ECOSYSTEM. Plans in EGP, billed monthly.

**Ecosystem** — **Five apps. One system.** Everyone who touches your gym gets their own app, and every app stays in sync.

**Apps** — Founder: *See the whole business. Run it from one place.* · Accountant: *From coach earnings to paid, with a clear record.* · Front desk: *Check-in, sales and bookings, all at the desk.* · Coaches: *Sessions, schedules and earnings, in one app.* · Client: *Your gym in your clients' pockets, under your brand.* This is the app that carries your gym's own brand.

**Plans** — **Four plans. One monthly price each.** Start small. Move up as you grow. **Extra clients never cost more than the next plan.** If extra-client charges would pass the next plan's price, you simply move up. All prices are EGP per month, excluding 14% VAT. VAT is added on the invoice.

**Compare** — **Every plan, side by side.** In every plan: memberships and class bundles (monthly, 3-month, annual, class passes), freezing a membership, class schedule and booking, payment tracking (cash, card, wallet, InstaPay with receipt approval), revenue dashboard, your own branding on the client experience.

**Add-ons** — **Add what you need.** Start with your plan. Add more whenever your gym needs it.

**FAQ** — **Questions owners ask.**

**Contact** — **Let's set up your gym.** One ecosystem. Your whole community. 01000401407 · info@bizqwik.com
