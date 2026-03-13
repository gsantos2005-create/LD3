const bcrypt = require('bcryptjs');
const db = require('./database');

const SALT_ROUNDS = 10;

console.log('Seeding LeadOS database...');

// ─── TEAM ─────────────────────────────────────────────────────────────────────
const existingTeam = db.prepare('SELECT id FROM teams WHERE id = 1').get();
if (!existingTeam) {
  db.prepare('INSERT INTO teams (id, name) VALUES (1, ?)').run('Team A');
  console.log('Created Team A (id=1)');
} else {
  console.log('Team A already exists, skipping.');
}

// ─── USERS ────────────────────────────────────────────────────────────────────
const usersToSeed = [
  { username: 'biohed',    password: 'Leader1!', role: 'leader', team_id: 1,    member_id: null },
  { username: 'boss',      password: 'Guest1!',  role: 'leader', team_id: null, member_id: null },
  { username: 'sarah.chen',password: 'Sarah1!',  role: 'ic',     team_id: 1,    member_id: 'M1' },
  { username: 'marcus.w',  password: 'Marcus1!', role: 'ic',     team_id: 1,    member_id: 'M2' },
  { username: 'elena.r',   password: 'Elena1!',  role: 'ic',     team_id: 1,    member_id: 'M3' },
  { username: 'james.p',   password: 'James1!',  role: 'ic',     team_id: 1,    member_id: 'M4' },
  { username: 'priya.s',   password: 'Priya1!',  role: 'ic',     team_id: 1,    member_id: 'M5' },
  { username: 'tom.b',     password: 'Tom1!',    role: 'ic',     team_id: 1,    member_id: 'M6' },
];

const insertUser = db.prepare(`
  INSERT OR IGNORE INTO users (username, password_hash, role, team_id, member_id)
  VALUES (?, ?, ?, ?, ?)
`);

for (const u of usersToSeed) {
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(u.username);
  if (!existing) {
    const hash = bcrypt.hashSync(u.password, SALT_ROUNDS);
    insertUser.run(u.username, hash, u.role, u.team_id, u.member_id);
    console.log(`Created user: ${u.username} (${u.role})`);
  } else {
    console.log(`User ${u.username} already exists, skipping.`);
  }
}

// ─── TEAM ACCESS for "boss" (guest_leader view of Team A) ────────────────────
const bossUser = db.prepare('SELECT id FROM users WHERE username = ?').get('boss');
if (bossUser) {
  const existingAccess = db.prepare('SELECT id FROM team_access WHERE user_id = ? AND team_id = 1').get(bossUser.id);
  if (!existingAccess) {
    db.prepare('INSERT INTO team_access (user_id, team_id) VALUES (?, 1)').run(bossUser.id);
    console.log('Granted boss view access to Team A');
  }
}

// ─── MEMBERS ─────────────────────────────────────────────────────────────────
const membersToSeed = [
  { id: 'M1', name: 'Sarah Chen',      initials: 'SC', role_title: 'Senior Engineer',   color: '#4f8ef7', weekly_capacity: 40 },
  { id: 'M2', name: 'Marcus Williams', initials: 'MW', role_title: 'Product Manager',   color: '#c9a84b', weekly_capacity: 40 },
  { id: 'M3', name: 'Elena Rodriguez', initials: 'ER', role_title: 'Data Analyst',      color: '#3ecf8e', weekly_capacity: 40 },
  { id: 'M4', name: 'James Park',      initials: 'JP', role_title: 'DevOps Lead',       color: '#e25b5b', weekly_capacity: 40 },
  { id: 'M5', name: 'Priya Sharma',    initials: 'PS', role_title: 'UX Designer',       color: '#a78bfa', weekly_capacity: 40 },
  { id: 'M6', name: 'Tom Bradley',     initials: 'TB', role_title: 'Backend Engineer',  color: '#f6a623', weekly_capacity: 40 },
];

const insertMember = db.prepare(`
  INSERT OR IGNORE INTO members (id, team_id, name, initials, role_title, color, weekly_capacity)
  VALUES (?, 1, ?, ?, ?, ?, ?)
`);

for (const m of membersToSeed) {
  insertMember.run(m.id, m.name, m.initials, m.role_title, m.color, m.weekly_capacity);
}
console.log('Members seeded.');

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
const leaderUser = db.prepare('SELECT id FROM users WHERE username = ?').get('biohed');
const createdBy = leaderUser ? leaderUser.id : 1;

const projectsToSeed = [
  { id: 'P1', name: 'Project Nexus',  desc: 'ERP Migration',         bp: 5, reg: 'High',   status: 'Active', color: '#e25b5b', deadline: '2026-04-30', biz_function: 'Finance & Operations' },
  { id: 'P2', name: 'Project Aurora', desc: 'Customer Portal',       bp: 4, reg: 'Medium', status: 'Active', color: '#c9a84b', deadline: '2026-03-15', biz_function: 'Customer Experience' },
  { id: 'P3', name: 'Project Delta',  desc: 'Data Warehouse',        bp: 3, reg: 'Low',    status: 'Active', color: '#4f8ef7', deadline: '2026-05-31', biz_function: 'Data & Analytics' },
  { id: 'P4', name: 'Project Titan',  desc: 'Infra Modernization',   bp: 4, reg: 'High',   status: 'Active', color: '#a78bfa', deadline: '2026-03-31', biz_function: 'IT Infrastructure' },
];

const insertProject = db.prepare(`
  INSERT OR IGNORE INTO projects (id, team_id, name, desc, bp, reg, status, color, deadline, biz_function, created_by)
  VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const p of projectsToSeed) {
  insertProject.run(p.id, p.name, p.desc, p.bp, p.reg, p.status, p.color, p.deadline, p.biz_function, createdBy);
}
console.log('Projects seeded.');

// ─── PROJECT STAKEHOLDERS ─────────────────────────────────────────────────────
const stakeholdersToSeed = [
  { project_id: 'P1', name: 'Diane Okafor',  role: 'Business Analyst' },
  { project_id: 'P1', name: 'Tom Hartley',   role: 'System Owner' },
  { project_id: 'P1', name: 'Priya Nair',    role: 'Change Lead' },
  { project_id: 'P1', name: 'Marcus Webb',   role: 'Vendor Liaison' },
  { project_id: 'P2', name: 'Kenji Mori',    role: 'UX Lead' },
  { project_id: 'P2', name: 'Sandra Ellis',  role: 'Product Owner' },
  { project_id: 'P2', name: 'Carla Ruiz',    role: 'Trainer' },
  { project_id: 'P3', name: 'Ahmed Farouk',  role: 'Data Architect' },
  { project_id: 'P3', name: 'Lin Zhao',      role: 'Compliance Officer' },
  { project_id: 'P4', name: 'Raj Patel',     role: 'Infrastructure Lead' },
  { project_id: 'P4', name: 'Fiona Grant',   role: 'Security Advisor' },
  { project_id: 'P4', name: 'Owen Tully',    role: 'Network Engineer' },
];

const existingStakeholders = db.prepare('SELECT COUNT(*) as cnt FROM project_stakeholders').get();
if (existingStakeholders.cnt === 0) {
  const insertStakeholder = db.prepare(`
    INSERT INTO project_stakeholders (project_id, name, role) VALUES (?, ?, ?)
  `);
  for (const s of stakeholdersToSeed) {
    insertStakeholder.run(s.project_id, s.name, s.role);
  }
  console.log('Stakeholders seeded.');
} else {
  console.log('Stakeholders already exist, skipping.');
}

// ─── TASKS ────────────────────────────────────────────────────────────────────
const tasksToSeed = [
  { id: 'T01', title: 'API Integration for Customer Portal',   mid: 'M1', pid: 'P2', priority: 'High',   bp: 4, reg: 'Medium', due: '2026-03-01', hours: 12, risk: 'amber', status: 'In Progress' },
  { id: 'T02', title: 'ERP Database Schema Review',            mid: 'M1', pid: 'P1', priority: 'High',   bp: 5, reg: 'High',   due: '2026-02-28', hours: 10, risk: 'red',   status: 'In Progress' },
  { id: 'T03', title: 'Code Review — Sprint 4',                mid: 'M1', pid: 'P4', priority: 'Medium', bp: 4, reg: 'Low',    due: '2026-03-07', hours: 8,  risk: 'green', status: 'Pending' },
  { id: 'T04', title: 'Performance Testing Suite',             mid: 'M1', pid: 'P2', priority: 'Low',    bp: 3, reg: 'Low',    due: '2026-03-14', hours: 4,  risk: 'green', status: 'Pending' },
  { id: 'T05', title: 'Executive Stakeholder Presentation',    mid: 'M2', pid: 'P1', priority: 'High',   bp: 5, reg: 'High',   due: '2026-02-27', hours: 8,  risk: 'red',   status: 'In Progress' },
  { id: 'T06', title: 'Customer Portal Requirements Doc',      mid: 'M2', pid: 'P2', priority: 'High',   bp: 4, reg: 'Medium', due: '2026-03-05', hours: 12, risk: 'amber', status: 'In Progress' },
  { id: 'T07', title: 'Sprint Planning Workshop',              mid: 'M2', pid: 'P3', priority: 'Medium', bp: 3, reg: 'Low',    due: '2026-03-10', hours: 6,  risk: 'green', status: 'Pending' },
  { id: 'T08', title: 'Infra Modernization Business Case',     mid: 'M2', pid: 'P4', priority: 'High',   bp: 4, reg: 'High',   due: '2026-03-03', hours: 10, risk: 'amber', status: 'In Progress' },
  { id: 'T09', title: 'Vendor Contract Negotiations',          mid: 'M2', pid: 'P1', priority: 'Medium', bp: 5, reg: 'Medium', due: '2026-03-15', hours: 4,  risk: 'green', status: 'Pending' },
  { id: 'T10', title: 'Data Quality Audit Framework',          mid: 'M3', pid: 'P3', priority: 'Medium', bp: 3, reg: 'Medium', due: '2026-03-10', hours: 10, risk: 'green', status: 'In Progress' },
  { id: 'T11', title: 'Customer Analytics Dashboard',          mid: 'M3', pid: 'P2', priority: 'Low',    bp: 3, reg: 'Low',    due: '2026-03-20', hours: 8,  risk: 'green', status: 'Pending' },
  { id: 'T12', title: 'ERP Migration Analytics Report',        mid: 'M3', pid: 'P1', priority: 'Medium', bp: 4, reg: 'High',   due: '2026-03-07', hours: 6,  risk: 'amber', status: 'In Progress' },
  { id: 'T13', title: 'Infra Server Setup — Titan',            mid: 'M4', pid: 'P4', priority: 'High',   bp: 4, reg: 'High',   due: '2026-02-28', hours: 15, risk: 'red',   status: 'In Progress' },
  { id: 'T14', title: 'ERP CI/CD Pipeline Build',              mid: 'M4', pid: 'P1', priority: 'High',   bp: 5, reg: 'High',   due: '2026-03-01', hours: 14, risk: 'red',   status: 'In Progress' },
  { id: 'T15', title: 'Customer Portal Security Audit',        mid: 'M4', pid: 'P2', priority: 'High',   bp: 4, reg: 'High',   due: '2026-03-05', hours: 12, risk: 'amber', status: 'Pending' },
  { id: 'T16', title: 'Data Warehouse Monitoring Setup',       mid: 'M4', pid: 'P3', priority: 'Medium', bp: 3, reg: 'Low',    due: '2026-03-12', hours: 8,  risk: 'green', status: 'Pending' },
  { id: 'T17', title: 'Customer Portal UX Research',           mid: 'M5', pid: 'P2', priority: 'High',   bp: 4, reg: 'Low',    due: '2026-03-08', hours: 10, risk: 'green', status: 'In Progress' },
  { id: 'T18', title: 'Design System Component Library',       mid: 'M5', pid: 'P4', priority: 'Low',    bp: 2, reg: 'Low',    due: '2026-03-21', hours: 6,  risk: 'green', status: 'Pending' },
  { id: 'T19', title: 'ERP User Journey Mapping',              mid: 'M5', pid: 'P1', priority: 'Medium', bp: 4, reg: 'Medium', due: '2026-03-14', hours: 4,  risk: 'green', status: 'Pending' },
  { id: 'T20', title: 'ERP Backend API Development',           mid: 'M6', pid: 'P1', priority: 'High',   bp: 5, reg: 'High',   due: '2026-03-03', hours: 14, risk: 'amber', status: 'In Progress' },
  { id: 'T21', title: 'Data Warehouse Query Optimization',     mid: 'M6', pid: 'P3', priority: 'Medium', bp: 3, reg: 'Low',    due: '2026-03-15', hours: 10, risk: 'green', status: 'Pending' },
  { id: 'T22', title: 'Customer Portal Auth Service',          mid: 'M6', pid: 'P2', priority: 'High',   bp: 4, reg: 'High',   due: '2026-03-07', hours: 8,  risk: 'amber', status: 'In Progress' },
  { id: 'T23', title: 'Unit Test Coverage Sprint',             mid: 'M6', pid: 'P2', priority: 'Low',    bp: 3, reg: 'Low',    due: '2026-03-18', hours: 4,  risk: 'green', status: 'Pending' },
];

const insertTask = db.prepare(`
  INSERT OR IGNORE INTO tasks (id, team_id, title, mid, pid, priority, bp, reg, due, hours, risk, status, created_by)
  VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const t of tasksToSeed) {
  insertTask.run(t.id, t.title, t.mid, t.pid, t.priority, t.bp, t.reg, t.due, t.hours, t.risk, t.status, createdBy);
}
console.log('Tasks seeded.');

// ─── RISKS ────────────────────────────────────────────────────────────────────
const risksToSeed = [
  { id: 'R1', title: 'Data Migration Integrity Risk',                pid: 'P1', owner: 'M4', severity: 'High',   status: 'Open',       mitigation: 'Parallel run testing for 2 weeks before cutover. Daily integrity checks. Rollback plan documented.', identified: '2026-01-15', due: '2026-02-28', notes: '3 data quality issues found in UAT. Escalated to data team.' },
  { id: 'R2', title: 'Regulatory Deadline Conflict — Titan & Nexus', pid: 'P4', owner: 'M2', severity: 'High',   status: 'Open',       mitigation: 'Requested 2-week extension from compliance team. Awaiting approval. Flagged to CTO.',                 identified: '2026-01-22', due: '2026-02-25', notes: 'Both projects have March compliance requirements. Single team overlap with James Park.' },
  { id: 'R3', title: 'Key Person Dependency — Infrastructure',       pid: 'P4', owner: 'M1', severity: 'High',   status: 'Open',       mitigation: 'Begin cross-training Tom Bradley on DevOps tooling. Document runbooks for core systems.',              identified: '2026-02-01', due: '2026-03-01', notes: 'James Park is single point of failure for all infra. Bus factor = 1.' },
  { id: 'R4', title: 'Integration Testing Gaps — Aurora',            pid: 'P2', owner: 'M6', severity: 'Medium', status: 'Open',       mitigation: 'Add integration test sprint before launch. Tom to own test coverage tracking.',                        identified: '2026-02-05', due: '2026-03-10', notes: 'Current test coverage at 34%. Target is 70% before launch.' },
  { id: 'R5', title: 'Resource Overallocation Crisis',               pid: 'P1', owner: 'M2', severity: 'High',   status: 'Open',       mitigation: 'Immediate task reassignment. Deprioritize Delta work for James and Marcus for 2 weeks.',                identified: '2026-02-12', due: '2026-02-20', notes: 'OVERDUE - Action required immediately. James at 122% capacity.' },
  { id: 'R6', title: 'Aurora Launch Date Slippage',                  pid: 'P2', owner: 'M2', severity: 'Medium', status: 'Monitoring', mitigation: 'Weekly scope review. CTO briefed. Contingency: phase 1 scope reduction identified.',                     identified: '2026-01-30', due: '2026-03-30', notes: 'Original March 15 target at risk. Phased launch under consideration.' },
];

const insertRisk = db.prepare(`
  INSERT OR IGNORE INTO risks (id, team_id, title, pid, owner, severity, status, mitigation, identified, due, notes, created_by)
  VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const r of risksToSeed) {
  insertRisk.run(r.id, r.title, r.pid, r.owner, r.severity, r.status, r.mitigation, r.identified, r.due, r.notes, createdBy);
}
console.log('Risks seeded.');

// ─── GOALS ────────────────────────────────────────────────────────────────────
const goalsToSeed = [
  { member_id: 'M1', title: 'Lead cross-functional team by Q3 2026' },
  { member_id: 'M1', title: 'Complete AWS Solutions Architect cert' },
  { member_id: 'M1', title: 'Mentor 1 junior engineer' },
  { member_id: 'M2', title: 'Define 2026 product roadmap by Q1' },
  { member_id: 'M2', title: 'Drive Nexus go-live by April' },
  { member_id: 'M2', title: 'Build stakeholder communication cadence' },
  { member_id: 'M3', title: 'Lead Data Governance framework' },
  { member_id: 'M3', title: 'Build executive analytics dashboards' },
  { member_id: 'M3', title: 'Learn dbt and data modeling' },
  { member_id: 'M4', title: 'Automate 80% of deployment pipeline' },
  { member_id: 'M4', title: 'Achieve SOC2 compliance by Q2' },
  { member_id: 'M4', title: 'Document all infra runbooks' },
  { member_id: 'M5', title: 'Deliver Aurora portal designs by Feb end' },
  { member_id: 'M5', title: 'Create scalable design system' },
  { member_id: 'M5', title: 'Run 3 user research sessions per quarter' },
  { member_id: 'M6', title: 'Lead auth service architecture for Aurora' },
  { member_id: 'M6', title: 'Improve code review turnaround' },
  { member_id: 'M6', title: 'Complete System Design course' },
];

const existingGoals = db.prepare('SELECT COUNT(*) as cnt FROM goals').get();
if (existingGoals.cnt === 0) {
  const insertGoal = db.prepare('INSERT INTO goals (member_id, team_id, title) VALUES (?, 1, ?)');
  for (const g of goalsToSeed) {
    insertGoal.run(g.member_id, g.title);
  }
  console.log('Goals seeded.');
} else {
  console.log('Goals already exist, skipping.');
}

// ─── STRENGTHS ────────────────────────────────────────────────────────────────
const strengthsToSeed = [
  { member_id: 'M1', text: 'Technical depth' },
  { member_id: 'M1', text: 'Problem-solving' },
  { member_id: 'M1', text: 'Collaboration' },
  { member_id: 'M1', text: 'Code quality' },
  { member_id: 'M2', text: 'Strategic thinking' },
  { member_id: 'M2', text: 'Stakeholder alignment' },
  { member_id: 'M2', text: 'Communication' },
  { member_id: 'M2', text: 'Prioritization' },
  { member_id: 'M3', text: 'Data quality' },
  { member_id: 'M3', text: 'Documentation' },
  { member_id: 'M3', text: 'Analytical rigor' },
  { member_id: 'M3', text: 'Attention to detail' },
  { member_id: 'M4', text: 'Infrastructure expertise' },
  { member_id: 'M4', text: 'Reliability' },
  { member_id: 'M4', text: 'Proactive risk flagging' },
  { member_id: 'M4', text: 'Deep technical knowledge' },
  { member_id: 'M5', text: 'User empathy' },
  { member_id: 'M5', text: 'Visual design' },
  { member_id: 'M5', text: 'Research facilitation' },
  { member_id: 'M5', text: 'Cross-team collaboration' },
  { member_id: 'M6', text: 'Backend architecture' },
  { member_id: 'M6', text: 'Delivery pace' },
  { member_id: 'M6', text: 'Team player' },
  { member_id: 'M6', text: 'Code clarity' },
];

const existingStrengths = db.prepare('SELECT COUNT(*) as cnt FROM member_strengths').get();
if (existingStrengths.cnt === 0) {
  const insertStrength = db.prepare('INSERT INTO member_strengths (member_id, team_id, text) VALUES (?, 1, ?)');
  for (const s of strengthsToSeed) {
    insertStrength.run(s.member_id, s.text);
  }
  console.log('Strengths seeded.');
} else {
  console.log('Strengths already exist, skipping.');
}

// ─── GROWTH ───────────────────────────────────────────────────────────────────
const growthToSeed = [
  { member_id: 'M1', text: 'Executive communication' },
  { member_id: 'M1', text: 'Project scoping' },
  { member_id: 'M1', text: 'Delegation' },
  { member_id: 'M2', text: 'Technical depth' },
  { member_id: 'M2', text: 'Data analysis' },
  { member_id: 'M2', text: 'Saying no to low-priority requests' },
  { member_id: 'M3', text: 'Presenting to senior stakeholders' },
  { member_id: 'M3', text: 'Proactive communication' },
  { member_id: 'M3', text: 'Influencing without authority' },
  { member_id: 'M4', text: 'Work-life balance' },
  { member_id: 'M4', text: 'Delegation' },
  { member_id: 'M4', text: 'Asking for help' },
  { member_id: 'M5', text: 'Advocating for design earlier in process' },
  { member_id: 'M5', text: 'Metrics-driven design decisions' },
  { member_id: 'M5', text: 'Presentation skills' },
  { member_id: 'M6', text: 'Estimation accuracy' },
  { member_id: 'M6', text: 'Proactive status updates' },
  { member_id: 'M6', text: 'Testing discipline' },
];

const existingGrowth = db.prepare('SELECT COUNT(*) as cnt FROM member_growth').get();
if (existingGrowth.cnt === 0) {
  const insertGrowth = db.prepare('INSERT INTO member_growth (member_id, team_id, text) VALUES (?, 1, ?)');
  for (const g of growthToSeed) {
    insertGrowth.run(g.member_id, g.text);
  }
  console.log('Growth areas seeded.');
} else {
  console.log('Growth areas already exist, skipping.');
}

// ─── NOTES LOG ────────────────────────────────────────────────────────────────
const notesToSeed = [
  { member_id: 'M1', datetime: '2026-02-20T09:15:00', text: 'Sarah is performing exceptionally on the Aurora API work. Ready for tech lead responsibilities — discuss in next 1:1.' },
  { member_id: 'M2', datetime: '2026-02-19T10:00:00', text: 'Marcus is stretched across too many workstreams. Need to prioritize — consider delegating the Delta sprint planning.' },
  { member_id: 'M3', datetime: '2026-02-18T14:30:00', text: 'Elena is well-paced and producing high-quality work. Good candidate for leading the Data Governance initiative in Q3.' },
  { member_id: 'M4', datetime: '2026-02-21T08:00:00', text: 'CRITICAL: James is severely overloaded at 122% capacity. Immediately reassign Security Audit to Tom. Discuss sustainable pace.' },
  { member_id: 'M5', datetime: '2026-02-17T11:45:00', text: 'Priya has strong output and good capacity headroom. Consider pulling in for Nexus user journey work earlier than planned.' },
  { member_id: 'M6', datetime: '2026-02-20T16:00:00', text: 'Tom is at 90% — near threshold. Monitor closely. Strong on delivery but tends to underestimate complexity.' },
];

const existingNotes = db.prepare('SELECT COUNT(*) as cnt FROM notes_log').get();
if (existingNotes.cnt === 0) {
  const insertNote = db.prepare('INSERT INTO notes_log (member_id, team_id, datetime, text) VALUES (?, 1, ?, ?)');
  for (const n of notesToSeed) {
    insertNote.run(n.member_id, n.datetime, n.text);
  }
  console.log('Notes log seeded.');
} else {
  console.log('Notes log already exists, skipping.');
}

// ─── COACHING LOG ─────────────────────────────────────────────────────────────
const coachingToSeed = [
  { member_id: 'M1', date: '2026-02-10', note: 'Discussed promotion criteria for Staff Engineer. Needs to demonstrate leadership on a critical initiative.' },
  { member_id: 'M1', date: '2026-01-20', note: 'Explored interest in tech lead responsibilities. Very receptive, asked sharp questions about scope and ownership.' },
  { member_id: 'M2', date: '2026-02-12', note: 'Marcus flagged burnout risk — managing 4 projects simultaneously. Agreed to deprioritize Delta involvement for 2 weeks.' },
  { member_id: 'M2', date: '2026-01-28', note: 'Strong executive presentation. Promotion conversation scheduled for Q2 review cycle.' },
  { member_id: 'M3', date: '2026-02-08', note: 'Elena expressed interest in a more senior role. Discussed Data Governance initiative as a stretch project.' },
  { member_id: 'M4', date: '2026-02-15', note: 'URGENT: James working evenings and weekends. Capacity crisis — Titan and Nexus both require him simultaneously. Must escalate resource conflict.' },
  { member_id: 'M4', date: '2026-01-30', note: 'James flagged that CI/CD pipeline for Nexus is more complex than estimated. Adding 4h buffer to estimate.' },
  { member_id: 'M5', date: '2026-02-09', note: 'Priya wants more exposure to product strategy conversations. Will invite to next product review.' },
  { member_id: 'M6', date: '2026-02-11', note: 'Estimation for auth service was off by 40%. Worked through root-cause — requirements were ambiguous at start. Created checklist for future estimation.' },
];

const existingCoaching = db.prepare('SELECT COUNT(*) as cnt FROM coaching_log').get();
if (existingCoaching.cnt === 0) {
  const insertCoaching = db.prepare('INSERT INTO coaching_log (member_id, team_id, date, note) VALUES (?, 1, ?, ?)');
  for (const c of coachingToSeed) {
    insertCoaching.run(c.member_id, c.date, c.note);
  }
  console.log('Coaching log seeded.');
} else {
  console.log('Coaching log already exists, skipping.');
}

// ─── DECISION LOG ─────────────────────────────────────────────────────────────
const decisionsToSeed = [
  { member_id: 'M1', date: '2026-02-05', decision: 'Assigned Sarah as tech lead for Project Aurora API integration',     rationale: 'Best technical match; strong development opportunity toward Staff Engineer goal' },
  { member_id: 'M2', date: '2026-02-01', decision: 'Escalated Aurora deadline to CTO — original March 15 target unachievable', rationale: 'Engineering capacity conflict with Nexus. New date TBD pending CTO review.' },
  { member_id: 'M3', date: '2026-01-15', decision: 'Assigned Elena as data lead for Project Delta analytics track',      rationale: 'Best skill match; workload allows capacity for new responsibility' },
  { member_id: 'M4', date: '2026-02-10', decision: 'Escalated James Park resource conflict to leadership',              rationale: 'Cannot deliver Titan infra setup AND Nexus CI/CD at same time without quality risk or burnout' },
  { member_id: 'M5', date: '2026-01-25', decision: 'Prioritized Aurora UX work over Titan design system',              rationale: 'Aurora has harder deadline and higher business priority' },
  { member_id: 'M6', date: '2026-02-03', decision: 'Tom to pair with Sarah on ERP database schema work',               rationale: 'Cross-training benefit; Sarah can unblock Tom on ERP domain knowledge' },
];

const existingDecisions = db.prepare('SELECT COUNT(*) as cnt FROM decision_log').get();
if (existingDecisions.cnt === 0) {
  const insertDecision = db.prepare('INSERT INTO decision_log (member_id, team_id, date, decision, rationale) VALUES (?, 1, ?, ?, ?)');
  for (const d of decisionsToSeed) {
    insertDecision.run(d.member_id, d.date, d.decision, d.rationale);
  }
  console.log('Decision log seeded.');
} else {
  console.log('Decision log already exists, skipping.');
}

console.log('\nSeed complete!');
console.log('\nTest accounts:');
console.log('  Leader:       biohed / Leader1!');
console.log('  Guest Leader: boss   / Guest1!');
console.log('  IC (Sarah):   sarah.chen / Sarah1!');
console.log('  IC (Marcus):  marcus.w   / Marcus1!');
console.log('  IC (Elena):   elena.r    / Elena1!');
console.log('  IC (James):   james.p    / James1!');
console.log('  IC (Priya):   priya.s    / Priya1!');
console.log('  IC (Tom):     tom.b      / Tom1!');
