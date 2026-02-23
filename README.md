# LeadOS — Leadership Command Center

**[▶ Open Live App](https://gsantos2005-create.github.io/LD3/)**

A single-file internal leadership dashboard for managing teams across multiple enterprise projects. Built for senior leaders who need visibility into workload, risk, and team health — not micromanagement.

---

## Features

### Overview Dashboard
- Weekly snapshot with KPI cards: team size, overloaded members, open risks, critical deadlines
- Top risks and critical deadlines at a glance
- Team capacity summary with visual bars
- Escalation alerts for members exceeding 100% capacity

### People Dashboard
- Card view of all team members
- Per-person: active projects, task list, priority breakdown, capacity %, risk status
- Click any card for a detailed task breakdown
- Add, edit, or remove team members with custom avatar colors and weekly capacity

### Workload & Capacity View
- Visual capacity bar per person (green ≤80% / amber 80–99% / red 100%+)
- **Drag-and-drop task reassignment** between team members
- Real-time capacity recalculation after reassignment
- Per-person weekly capacity (configurable, defaults to 40h)

### Project & Priority Tracking
- Project cards with status, business priority, regulatory impact, deadline, and task count
- Full task table with sort and filter by project, priority, risk level, due date, and business priority
- Business priority pips (1–5 scale) and regulatory impact badges
- Automatic conflict detection for same-person, same-day high-priority deadline clashes
- Add, edit, and delete projects and tasks

### Risk Tracker
- Risk register with severity, status, owner, mitigation plan, and notes
- Aging tracker showing days since identified
- Automatic overdue alerts with pulsing indicators
- Add, edit, and update risk status (Open / Monitoring / Closed)

### 1:1 Leadership Support
- Per-person notes, development goals, strengths, and growth areas
- Coaching log with date-stamped entries
- Decision log with decision and rationale
- All data persists within the session and can be saved to browser storage

### Data Management
- **Export** current data as a timestamped JSON file
- **Copy** JSON to clipboard
- **Import** from a JSON file or paste directly
- **Save to browser** (localStorage) — auto-restored on next visit
- All exports include projects, tasks, risks, and team data

### UI
- Dark/light mode toggle (preference saved across sessions)
- Clean dark navy + warm gold design
- Cormorant Garamond + DM Sans + DM Mono typography
- Fully interactive — no build step, no dependencies

---

## Getting Started

No installation or server required. Just open the file in any modern browser.

```bash
git clone https://github.com/gsantos2005-create/LD3.git
cd LD3
# Open in browser
open leadership-dashboard.html        # macOS
start leadership-dashboard.html       # Windows
xdg-open leadership-dashboard.html   # Linux
```

Or download `leadership-dashboard.html` and double-click it.

---

## Data Persistence

Data lives in memory during a session. To keep it across sessions:

1. Click **Data** in the topbar
2. Choose **Save to browser** — restores automatically on next open
3. Or use **Download as JSON** to keep a portable backup

To restore a previous session, use **Load from JSON file** or **Paste JSON**.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Structure | HTML5 |
| Styling | Vanilla CSS (custom properties, no framework) |
| Logic | Vanilla JavaScript (no libraries) |
| Fonts | Google Fonts — Cormorant Garamond, DM Sans, DM Mono |
| Persistence | Browser localStorage + JSON file export |

---

## Suggested Enhancements

- Backend API (Node/Express or Python/FastAPI) for multi-user persistence
- SQLite or PostgreSQL for durable storage
- Authentication for team access control
- Email/Slack alerts for overdue risks and overloaded capacity
- Calendar integration for deadline sync

---

## License

MIT
