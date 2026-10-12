#!/usr/bin/env python3
"""Generates index.html (the editable deck source) from the content below.

Run:  python3 build.py && node render.mjs
All copy lives in this file; prices/limits follow BIZQWIK_DECK_BRIEF.md section 3.
"""
from html import escape as e

TOTAL = 15

import json, re as _re
SOLAR = json.load(open("icons.json"))
APP_ICON = {"founder": "chart-square", "accountant": "calculator", "frontdesk": "qr-code", "coaches": "users-group-two-rounded", "client": "smartphone"}


def solar(name, size=24, weight="bold-duotone"):
    svg = SOLAR[f"{weight}/{name}"]
    svg = _re.sub(r' style="[^"]*"', "", svg, count=1)
    return svg.replace("<svg ", f'<svg width="{size}" height="{size}" ', 1)


CHECK = solar("check-circle", 32)
CHECK_SM = solar("check-circle", 28)


def icon(key, size=44):
    return solar(APP_ICON[key], size, "linear")


APPS = [
    ("founder", "Founder / C-suite app", "Gym owner, department head"),
    ("accountant", "Accountant dashboard", "Accountant"),
    ("frontdesk", "Front-desk / reception app", "Front desk"),
    ("coaches", "Coaches app", "Coaches"),
    ("client", "Branded client app", "The gym's clients"),
]

# Device geometry: screen window inside each supplied frame image (px in the frame file).
FRAMES = {
    "phone": dict(img="assets/frame-phone.webp", w=980, h=2000, x=51, y=45, sw=878, sh=1910, r=96),
    "tablet": dict(img="assets/frame-tablet.webp", w=2000, h=1533, x=84, y=79, sw=1832, sh=1375, r=38),
}
STATUS_BAR = (
    '<div class="sb"><span class="t">9:41</span><span class="ri">'
    '<svg width="19" height="12" viewBox="0 0 19 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#1A1726"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#1A1726"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#1A1726"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#1A1726"/></svg>'
    '<svg width="17" height="12" viewBox="0 0 17 12" fill="none" stroke="#1A1726" stroke-width="1.8" stroke-linecap="round"><path d="M1.2 4.3a10 10 0 0 1 14.6 0"/><path d="M3.8 7a6.3 6.3 0 0 1 9.4 0"/><circle cx="8.5" cy="10" r="1.2" fill="#1A1726" stroke="none"/></svg>'
    '<svg width="27" height="13" viewBox="0 0 27 13"><rect x=".5" y=".5" width="23" height="12" rx="3.6" fill="none" stroke="#1A1726" opacity=".4"/><rect x="2" y="2" width="20" height="9" rx="2.4" fill="#1A1726"/><path d="M25 4.5v4a2 2 0 0 0 0-4z" fill="#1A1726" opacity=".45"/></svg>'
    '</span></div>'
)


def device(kind, shot, width, style="", bg="#F3F2EE"):
    f = FRAMES[kind]
    h = round(width * f["h"] / f["w"])
    pct = lambda v, t: f"{v / t * 100:.3f}%"
    k = width / f["w"]
    scr = (f'left:{pct(f["x"], f["w"])};top:{pct(f["y"], f["h"])};width:{pct(f["sw"], f["w"])};'
           f'height:{pct(f["sh"], f["h"])};border-radius:{f["r"] * k:.1f}px;background:{bg}')
    if kind == "phone":
        # Virtual 390x849 iPhone screen: status bar on top, app below it, home-indicator strip at the bottom.
        scale = f["sw"] * k / 390
        inner = (f'<div class="inner" style="transform:scale({scale:.4f})">{STATUS_BAR}'
                 f'<img class="app" src="assets/shots/{shot}" alt=""><div class="hi"></div></div>')
    else:
        inner = f'<img class="app tab" src="assets/shots/{shot}" alt="">'
    return (f'<div class="dev" style="width:{width}px;height:{h}px;{style}"><div class="back" style="{scr}"></div>'
            f'<div class="screen" style="{scr}">{inner}</div>'
            f'<img class="frm" src="{f["img"]}" alt=""></div>')


def slot(kind, width, label):
    """Clearly marked empty device slot (used when no mockup/screen exists)."""
    f = FRAMES[kind]
    h = round(width * f["h"] / f["w"])
    return f'<div class="slot" style="width:{width}px;height:{h}px"><span>{e(label)}</span></div>'


import math

SECTIONS = {}


def chrome(n, section=""):
    sec = f'<span class="sec">{e(section)}</span>' if section else ""
    return (f'<img class="logo" src="assets/logo.webp" alt="Bizqwik">'
            f'<div class="pill">{sec}<b>{n:02d}</b><i>/ {TOTAL}</i></div>')


slides = []


def add(html, cls=""):
    slides.append((html, cls))


def chip_icons(size=26, cls="mini"):
    return "".join(f'<span class="{cls}">{icon(k, size)}</span>' for k, _, _ in APPS)


# ---------------------------------------------------------------- 1 Cover
add(f"""
<img class="logo cover-logo" src="assets/logo.webp" alt="Bizqwik">
<div class="cover-copy">
  <div class="eyebrow">Product &amp; pricing</div>
  <h1>One ecosystem.<br>Your whole <span class="hlw">community.</span></h1>
  <p class="lede">Founder, accountant, front desk, coaches and clients, all in sync.</p>
  <div class="strip">{chip_icons(30, "mini lg")}<span class="strip-t">Five apps<br>One ecosystem</span></div>
</div>
<div class="cover-art">
  <div class="blob"></div>
  {device("tablet", "founder-oversight.png", 760, "left:10px;top:250px")}
  {device("phone", "client-pulse.png", 260, "left:520px;top:390px", "#fff")}
</div>
""", "cover")

# ---------------------------------------------------------------- 2 Ecosystem
ROLE = [
    "Sets prices, schedules and the team",
    "Runs the monthly payout",
    "Checks clients in and takes payments",
    "Logs sessions and tracks earnings",
    "Books, buys and checks in",
]
tiles = ""
for i, (k, name, by) in enumerate(APPS):
    tiles += (f'<div class="eco-tile"><div class="eco-top"><div class="eco-ico">{icon(k, 52)}</div><div class="eco-n">0{i + 1}</div></div>'
              f'<h3>{e(name)}</h3><div class="eco-role">{e(ROLE[i])}</div>'
              f'<div class="eco-by"><span>Used by</span>{e(by)}</div></div>')
    if i < 4:
        tiles += f'<div class="eco-arrow">{solar("alt-arrow-right", 26, "linear")}</div>'
add(f"""
{chrome(2, "The ecosystem")}
<div class="head"><h2>Five apps.<br>One system.</h2>
<p class="lede">Everyone who touches your gym gets their own app,<br>and every app stays in sync.</p></div>
<div class="eco">{tiles}</div>
""", "eco-slide")


# ---------------------------------------------------------------- 3-7 Apps
def lead(b):
    """Bold the lead-in before the first colon (wording unchanged)."""
    if ":" in b:
        a, rest = b.split(":", 1)
        if len(a) <= 42:
            return f"<b>{e(a)}:</b>{e(rest)}"
    return e(b)


def app_slide(n, key, title, used, headline, bullets, art, caption="", extra_top="", extra_bottom="", art_cls=""):
    idx = [k for k, _, _ in APPS].index(key)
    nav = "".join(f'<span class="an{" on" if i == idx else ""}">{icon(k, 22)}</span>' for i, (k, _, _) in enumerate(APPS))
    lis = ""
    for b in bullets:
        tag, hl = "", ""
        if isinstance(b, tuple):
            b, t = b
            if t == "hl":
                hl = "hl"
            else:
                tag = f' <span class="tag">{e(t)}</span>'
        lis += f'<li class="{hl}"><span class="chk">{CHECK}</span><span>{lead(b)}{tag}</span></li>'
    cap = f'<div class="art-cap">{e(caption)}</div>' if caption else ""
    add(f"""
{chrome(n, "The apps")}
<div class="appnav">{nav}</div>
<div class="app-copy">
  <div class="app-eyebrow"><div class="eco-ico xs">{icon(key, 30)}</div><span class="lab">App {idx + 1} · {e(title)}</span><span class="chip">Used by: {e(used)}</span></div>
  <h2 class="app-h">{e(headline)}</h2>
  {extra_top}
  <ul class="feat">{lis}</ul>
  {extra_bottom}
</div>
<div class="app-art {art_cls}">{art}{cap}</div>
""", "app")


app_slide(3, "founder", "Founder / C-suite app", "Gym owner, department head",
          "See the whole business. Run it from one place.", [
    "See revenue, profit, coach payouts and active subscribers in one dashboard.",
    "Set prices, memberships, bundles and class schedules.",
    "Manage the team: invite staff, give each a role, assign coach tiers and rates.",
    "Set personal training packages and each tier's cut.",
    "Review and approve sessions and InstaPay receipts.",
    "Staff attendance: see who attended and exactly when, with timestamps, and who was late or on time against the assigned session time.",
    "Brand your client app in minutes.",
    ("Run several departments and locations, each with its own prices, coaches and sessions.", "Scale plan only"),
], '<div class="blob"></div>' + device("tablet", "founder-oversight.png", 860), caption="Founder dashboard · Overview")

app_slide(4, "accountant", "Accountant dashboard", "Accountant",
          "From coach earnings to paid, with a clear record.", [
    "See revenue and each coach's earnings for the month.",
    "Run the monthly payout: settle, pay, mark paid.",
    "Keep a clear record of what was paid and when.",
], '<div class="blob"></div>' + device("tablet", "accountant-pay.png", 860), caption="Accountant dashboard · To pay")

app_slide(5, "frontdesk", "Front-desk / reception app", "Front desk",
          "Check-in, sales and bookings, all at the desk.", [
    "Check clients in by QR code.",
    "Sell memberships, bundles and drop-in passes.",
    "Take payments: cash, card, wallet or InstaPay.",
    "Book clients into classes and see who is coming.",
    "Freeze a client's membership.",
], '<div class="blob"></div><div class="duo-wrap">' + device("tablet", "desk-calendar.png", 600, "left:0;top:60px")
   + device("phone", "desk-home.png", 290, "left:570px;top:0") + '</div>',
          caption="Class calendar (week view) · Home", art_cls="duo")

tiers = '<div class="tiers"><span>Junior coach</span><span>Senior coach</span><span class="on">Head coach</span></div>'
app_slide(6, "coaches", "Coaches app", "Coaches",
          "Sessions, schedules and earnings, in one app.", [
    "Log sessions by scanning a QR in the coaches' room.",
    "See what you've earned this month at your tier's rate.",
    "Deliver personal training sessions by scanning the client's PT code.",
    ("Monthly scheduling: the head coach sets the whole month up front, with dates and start times, and assigns classes to coaches.", "hl"),
    "Attendance on your assigned date only: a coach can't log a session outside their assigned slot.",
    ("Hand over a session: a coach can assign or request a swap with another coach, at least 2 hours before the session, and only if the other coach accepts.", "hl"),
    "Head coach: review and edit sessions and handle settlements.",
], '<div class="blob"></div>' + device("phone", "coach-home.png", 390), caption="Coaches app · My month", extra_top=tiers)

app_slide(7, "client", "Branded client app", "The gym's clients",
          "Your gym in your clients' pockets, under your brand.", [
    "Your gym's own name, logo, colours and web address.",
    "Check in with a QR code.",
    "Book classes and say \"I'm coming\".",
    "Buy memberships and bundles.",
    "Top up a wallet and earn loyalty points.",
    "Freeze your own plan.",
], '<div class="blob"></div><div class="trio-wrap">'
   + device("phone", "client-forge.png", 284, "left:0;top:90px", "#fff")
   + '<div class="bn" style="left:0;top:690px;width:284px">Forge Athletics</div>'
   + device("phone", "client-grove.png", 284, "left:298px;top:0px", "#EFE8D8")
   + '<div class="bn" style="left:298px;top:600px;width:284px">Grove Pilates</div>'
   + device("phone", "client-pulse.png", 284, "left:596px;top:90px", "#fff")
   + '<div class="bn" style="left:596px;top:690px;width:284px">Pulse Studio</div>'
   + '<div class="bn cap" style="left:0;top:740px;width:880px">Same app, three illustrative gym brands</div></div>',
   art_cls="trio")

# ---------------------------------------------------------------- 8 Plans at a glance
PLANS = {
    "Start": dict(price="1,290", who="Independent coaches and solo studios", inc="60", extra="25 EGP", staff="1", dept="1", loc="1",
                  exp="Branded booking page", integ="—", line="The founder app and a branded booking page.",
                  apps=dict(founder="Single-role: the owner does everything")),
    "Grow": dict(price="4,990", who="Studios and gyms with a team", inc="300", extra="20 EGP", staff="10", dept="1", loc="1",
                 exp="Branded client app (PWA)", integ="—", line="All five apps, with a branded client app (PWA).",
                 apps=dict(founder="", accountant="", frontdesk="", coaches="Junior, senior, head", client="PWA")),
    "Scale": dict(price="14,990", who="Clubs with several departments", inc="1,500", extra="12 EGP", staff="5 per department", dept="5", loc="2–3",
                  exp="Native app on the app stores", integ="Included", line="Several departments, 2–3 locations and a native app on the app stores.",
                  apps=dict(founder="Per department", accountant="", frontdesk="", coaches="Junior, senior, head", client="Native, on the stores")),
    "Enterprise": dict(price=None, who="Large or multi-site communities", inc="Custom", extra="Custom", staff="Custom", dept="Custom", loc="Custom",
                       exp="Custom", integ="Custom", line="Everything is custom, built around your community.",
                       apps=dict(founder="Custom", accountant="Custom", frontdesk="Custom", coaches="Custom", client="Custom")),
}

cards = ""
for name, p in PLANS.items():
    grow = name == "Grow"
    price = (f'<div class="price"><b>{p["price"]}</b><span>EGP / month</span></div>' if p["price"]
             else '<div class="price"><b class="contact">Contact us</b><span>&nbsp;</span></div>')
    label = '<div class="best">Best fit for studios</div>' if grow else '<div class="best ghost">&nbsp;</div>'
    cards += f"""<div class="pcard{' grow' if grow else ''}">
  {label}<h3>{name}</h3><div class="who">{e(p["who"])}</div>{price}
  <div class="pl"><span>Active clients included</span><b>{p["inc"]}</b></div>
  <div class="pl"><span>Each extra client</span><b>{p["extra"]}</b></div></div>"""
add(f"""
{chrome(8, "Plans")}
<div class="head g"><h2>Four plans.<br>One monthly price each.</h2>
<p class="lede">Start small. Move up as you grow.</p></div>
<div class="pgrid">{cards}</div>
<div class="foot-notes g"><div class="rule"><span class="ri">{solar("star", 28, "bold-duotone")}</span><span><b>Extra clients never cost more than the next plan.</b> If extra-client charges would pass the next plan's price, you simply move up.</span></div>
<div class="note">All prices are EGP per month, excluding 14% VAT. VAT is added on the invoice.</div></div>
""", "glance")


# ---------------------------------------------------------------- 9-12 Plans
def plan_slide(n, name):
    p = PLANS[name]
    tiles = ""
    for k, an, _ in APPS:
        inc = k in p["apps"]
        cap = p["apps"].get(k, "")
        tiles += (f'<div class="ptile{"" if inc else " off"}"><div class="eco-ico">{icon(k, 44)}</div>'
                  f'<h4>{e(an)}</h4><div class="cap">{e(cap) if cap else ("Included" if inc else "Not included")}</div></div>')
    price = (f'<div class="bigprice"><b>{p["price"]}</b><span>EGP / month</span></div>' if p["price"]
             else '<div class="bigprice"><b class="contact">Contact us</b></div>')
    best = '<span class="best inline">Best fit for studios</span>' if name == "Grow" else ""
    rows = [("Active clients included", p["inc"]), ("Each extra client", p["extra"]), ("Staff", p["staff"]),
            ("Departments", p["dept"]), ("Locations", p["loc"]), ("Physical integrations (e.g. gate access)", p["integ"])]
    lim = "".join(f'<div class="lim"><span>{e(a)}</span><b>{e(b)}</b></div>' for a, b in rows)
    stepper = "".join(f'<span class="{"on" if x == name else ""}">{x}</span>' for x in PLANS)
    add(f"""
{chrome(n, "Plans")}
<div class="plan-left">
  <div class="stepper">{stepper}</div>
  <div class="plan-name"><h2>{name}</h2>{best}</div>
  {price}
  <div class="pline">{e(p["line"])}</div>
  <div class="who big"><span>For</span>{e(p["who"])}</div>
  <div class="cx"><span>Client experience</span><b>{e(p["exp"])}</b></div>
</div>
<div class="plan-right">
  <div class="sub">Apps included</div>
  <div class="ptiles">{tiles}</div>
  <div class="sub">Limits</div>
  <div class="lims">{lim}</div>
</div>
""", "plan")


for i, nm in enumerate(["Start", "Grow", "Scale", "Enterprise"]):
    plan_slide(9 + i, nm)

# ---------------------------------------------------------------- 13 Compare
cols = ["Start", "Grow", "Scale", "Enterprise"]


def row(label, vals, cls=""):
    return f'<tr class="{cls}"><th>{e(label)}</th>' + "".join(f"<td>{v}</td>" for v in vals) + "</tr>"


ok = f'<span class="ok">{CHECK_SM}</span>'
dash = '<span class="no">—</span>'
tbl = row("Price (EGP / month)", ["<b>1,290</b>", "<b>4,990</b>", "<b>14,990</b>", "<b>Contact us</b>"], "prow")
tbl += row("For", [PLANS[c]["who"] for c in cols], "small")
tbl += row("Active clients included", ["60", "300", "1,500", "Custom"])
tbl += row("Each extra client", ["25 EGP", "20 EGP", "12 EGP", "Custom"])
tbl += row("Staff", ["1", "10", "5 per department", "Custom"])
tbl += row("Departments", ["1", "1", "5", "Custom"])
tbl += row("Locations", ["1", "1", "2–3", "Custom"])
tbl += row("Client experience", ["Branded booking page", "Branded client app (PWA)", "Native app on the app stores", "Custom"])
tbl += row("Physical integrations (e.g. gate access)", [dash, dash, "Included", "Custom"])
tbl += row("Founder / C-suite app", [f"{ok} single-role: the owner does everything", ok, f"{ok} per department", "Custom"], "app")
tbl += row("Accountant dashboard", [dash, ok, ok, "Custom"], "app")
tbl += row("Front-desk / reception app", [dash, ok, ok, "Custom"], "app")
tbl += row("Coaches app (junior, senior, head)", [dash, ok, ok, "Custom"], "app")
tbl += row("Branded client app", ["Booking page", "PWA", "Native app on the stores", "Custom"], "app")
add(f"""
{chrome(13, "Compare")}
<div class="head tight"><h2>Every plan, side by side.</h2></div>
<div class="cmp-card"><table class="cmp"><thead><tr><th></th>{"".join(f"<th>{c}</th>" for c in cols)}</tr></thead><tbody>{tbl}</tbody></table></div>
<div class="foot-notes tight"><div class="note">All prices are EGP per month, excluding 14% VAT.</div>
<div class="all"><b>In every plan:</b> memberships and class bundles (monthly, 3-month, annual, class passes), freezing a membership, class schedule and booking, payment tracking (cash, card, wallet, InstaPay with receipt approval), revenue dashboard, your own branding on the client experience.</div></div>
""", "compare")

# ---------------------------------------------------------------- 14 Add-ons
ADD_ICONS = ["smartphone", "smartphone-update", "stars", "cpu-bolt", "buildings", "map-point-add", "user-plus", "chat-round-dots"]
ADD_TAG = ["Client app", "Client app", "AI", "AI", "Team & sites", "Team & sites", "Team & sites", "Messaging"]
ADD = [
    ("Branded native app on the app stores", "Your own app in the App Store and Google Play, under your name"),
    ("Branded client app (PWA)", "Your own installable app for clients, for plans that don't include it"),
    ("AI assistant", "Ask questions about your gym in plain language and get answers and analysis"),
    ("AI agent", "An assistant that does tasks for you inside the app, not just answers"),
    ("Extra department", "Add another department with its own prices, coaches and sessions"),
    ("Extra location", "Add another branch"),
    ("Extra staff member", "Add more team seats"),
    ("WhatsApp / SMS messages", "Send reminders, renewals and announcements to clients"),
]
acards = "".join(
    f'<div class="acard"><div class="atop"><div class="plus">{solar(ADD_ICONS[i], 32, "linear")}</div><span class="atag">{ADD_TAG[i]}</span></div>'
    f'<h3>{e(a)}</h3><p>{e(b)}</p></div>' for i, (a, b) in enumerate(ADD))
add(f"""
{chrome(14, "Add-ons")}
<div class="head g"><h2>Add what you need.</h2>
<p class="lede">Start with your plan. Add more whenever your gym needs it.</p></div>
<div class="agrid">{acards}</div>
""", "addons")

# ---------------------------------------------------------------- 15 Closing
orbit = "".join(
    f'<div class="ci" style="left:{360 + 300 * math.cos(math.radians(-90 + i * 72)) - 60:.1f}px;top:{360 + 300 * math.sin(math.radians(-90 + i * 72)) - 60:.1f}px"><div class="eco-ico">{icon(k, 56)}</div></div>'
    for i, (k, _, _) in enumerate(APPS))
add(f"""
<img class="logo cover-logo" src="assets/logo.webp" alt="Bizqwik">
<div class="close-copy">
  <h1>Let's set up<br>your gym.</h1>
  <p class="lede">One ecosystem. Your whole community.</p>
  <div class="placeholder"><span>GAP · CONTACT DETAILS</span>[ Contact details to be added: name, phone, email, web address ]</div>
</div>
<div class="close-art"><div class="orbit"></div>
  <div class="hub"><img src="assets/mark.png" alt="Bizqwik"></div>{orbit}</div>
""", "cover close")

CSS = open("deck.css").read()
body = "".join(f'<section class="slide {c}">{h}</section>\n' for h, c in slides)
html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Bizqwik Product &amp; Pricing</title>
<meta name="viewport" content="width=1920">
<link rel="stylesheet" href="assets/fonts.css">
<style>{CSS}</style></head><body>
{body}</body></html>"""
open("index.html", "w").write(html)
print("wrote index.html,", len(slides), "slides")
