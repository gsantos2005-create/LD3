const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// All API routes require authentication
router.use(requireAuth);

// ─── PERMISSION HELPERS ───────────────────────────────────────────────────────
function isLeader(req) {
  return req.user.role === 'leader' && req.user.teamId != null;
}

function isIC(req) {
  return req.user.role === 'ic';
}

function isGuestLeader(req) {
  return req.user.role === 'leader' && req.user.teamId == null;
}

function canEditTeam(req, teamId) {
  if (isGuestLeader(req)) return false;
  if (isLeader(req) && req.user.teamId === teamId) return true;
  return false;
}

function logAudit(teamId, userId, username, action, entityType, entityId, entityTitle) {
  try {
    db.prepare(`
      INSERT INTO audit_log (team_id, user_id, username, action, entity_type, entity_id, entity_title)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(teamId, userId, username, action, entityType, String(entityId || ''), entityTitle || '');
  } catch (e) {
    // non-fatal
  }
}

// ─── LOAD FULL TEAM DATA (helper) ─────────────────────────────────────────────
function loadTeamData(teamId, includePrivate) {
  const members = db.prepare('SELECT * FROM members WHERE team_id = ?').all(teamId);

  const enrichedMembers = members.map(m => {
    const goals     = db.prepare('SELECT id, title FROM goals WHERE member_id = ? AND team_id = ?').all(m.id, teamId);
    const strengths = db.prepare('SELECT id, text FROM member_strengths WHERE member_id = ? AND team_id = ?').all(m.id, teamId);
    const growth    = db.prepare('SELECT id, text FROM member_growth WHERE member_id = ? AND team_id = ?').all(m.id, teamId);

    const base = { ...m, goals, strengths, growth };

    if (includePrivate) {
      const notesLog    = db.prepare('SELECT id, datetime, text FROM notes_log WHERE member_id = ? AND team_id = ? ORDER BY datetime DESC').all(m.id, teamId);
      const coachingLog = db.prepare('SELECT id, date, note FROM coaching_log WHERE member_id = ? AND team_id = ? ORDER BY date DESC').all(m.id, teamId);
      const decisionLog = db.prepare('SELECT id, date, decision, rationale FROM decision_log WHERE member_id = ? AND team_id = ? ORDER BY date DESC').all(m.id, teamId);
      return { ...base, notesLog, coachingLog, decisionLog };
    }
    return { ...base, notesLog: [], coachingLog: [], decisionLog: [] };
  });

  const projects = db.prepare('SELECT * FROM projects WHERE team_id = ?').all(teamId);
  const enrichedProjects = projects.map(p => {
    const stakeholders = db.prepare('SELECT id, name, role FROM project_stakeholders WHERE project_id = ?').all(p.id);
    return { ...p, bizFunction: p.biz_function, stakeholders };
  });

  const tasks = db.prepare('SELECT * FROM tasks WHERE team_id = ?').all(teamId);
  const risks = db.prepare('SELECT * FROM risks WHERE team_id = ?').all(teamId);

  const teamNotes = includePrivate
    ? db.prepare('SELECT * FROM team_notes WHERE team_id = ? ORDER BY datetime DESC').all(teamId)
    : [];

  const meetingMinutes = includePrivate
    ? db.prepare('SELECT * FROM meeting_minutes WHERE team_id = ? ORDER BY datetime DESC').all(teamId)
    : [];

  return { team: enrichedMembers, projects: enrichedProjects, tasks, risks, teamNotes, meetingMinutes };
}

// ─── GET /api/data ─────────────────────────────────────────────────────────────
router.get('/data', (req, res) => {
  const user = req.user;

  if (isLeader(req)) {
    const data = loadTeamData(user.teamId, true);
    return res.json({ ...data, guestTeams: [] });
  }

  if (isIC(req)) {
    const teamId   = user.teamId;
    const memberId = user.memberId;

    // IC's own full member record (no private logs)
    const memberRow = db.prepare('SELECT * FROM members WHERE id = ? AND team_id = ?').get(memberId, teamId);
    if (!memberRow) return res.json({ team: [], projects: [], tasks: [], risks: [], teamNotes: [], meetingMinutes: [], guestTeams: [] });

    const goals     = db.prepare('SELECT id, title FROM goals WHERE member_id = ? AND team_id = ?').all(memberId, teamId);
    const strengths = db.prepare('SELECT id, text FROM member_strengths WHERE member_id = ? AND team_id = ?').all(memberId, teamId);
    const growth    = db.prepare('SELECT id, text FROM member_growth WHERE member_id = ? AND team_id = ?').all(memberId, teamId);
    const member = { ...memberRow, goals, strengths, growth, notesLog: [], coachingLog: [], decisionLog: [] };

    // Basic info for all team members (name resolution only — no private data)
    const allMembers = db.prepare('SELECT id, name, initials, role_title, color, weekly_capacity FROM members WHERE team_id = ?').all(teamId);
    const teamIndex = allMembers.map(m => ({ ...m, goals: [], strengths: [], growth: [], notesLog: [], coachingLog: [], decisionLog: [] }));
    // Replace IC's own entry with the full record
    const team = teamIndex.map(m => m.id === memberId ? member : m);

    const tasks = db.prepare('SELECT * FROM tasks WHERE team_id = ? AND mid = ?').all(teamId, memberId);
    const risks = db.prepare('SELECT * FROM risks WHERE team_id = ? AND owner = ?').all(teamId, memberId);

    // Projects where IC has tasks OR is the owner
    const taskProjectIds = tasks.filter(t => t.pid).map(t => t.pid);
    const ownedProjects  = db.prepare('SELECT id FROM projects WHERE team_id = ? AND owner = ?').all(teamId, memberId).map(p => p.id);
    const myProjectIds   = [...new Set([...taskProjectIds, ...ownedProjects])];

    let projects = [];
    if (myProjectIds.length > 0) {
      const placeholders = myProjectIds.map(() => '?').join(',');
      const rawProjects = db.prepare(`SELECT * FROM projects WHERE team_id = ? AND id IN (${placeholders})`).all(teamId, ...myProjectIds);
      projects = rawProjects.map(p => {
        const stakeholders = db.prepare('SELECT id, name, role FROM project_stakeholders WHERE project_id = ?').all(p.id);
        return { ...p, bizFunction: p.biz_function, stakeholders };
      });
    }

    return res.json({
      team,
      projects,
      tasks,
      risks,
      teamNotes: [],
      meetingMinutes: [],
      guestTeams: [],
    });
  }

  if (isGuestLeader(req)) {
    const accesses = db.prepare('SELECT team_id FROM team_access WHERE user_id = ?').all(user.id);
    const guestTeams = accesses.map(a => {
      const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(a.team_id);
      const data = loadTeamData(a.team_id, true);
      return {
        teamId:   a.team_id,
        teamName: team ? team.name : `Team ${a.team_id}`,
        readOnly: true,
        data,
      };
    });
    return res.json({ team: [], projects: [], tasks: [], risks: [], teamNotes: [], meetingMinutes: [], guestTeams });
  }

  res.status(403).json({ error: 'Access denied' });
});

// ─── TASKS ────────────────────────────────────────────────────────────────────
router.post('/tasks', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const teamId = user.teamId;
  const body = req.body;

  // IC: must use own member_id
  if (isIC(req) && body.mid !== user.memberId) {
    return res.status(403).json({ error: 'ICs can only create tasks for themselves' });
  }

  const id = body.id || ('T' + Date.now());
  try {
    db.prepare(`
      INSERT INTO tasks (id, team_id, title, mid, pid, priority, bp, reg, due, hours, risk, status, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, teamId,
      body.title, body.mid, body.pid || null,
      body.priority || 'Medium',
      body.bp || 3,
      body.reg || 'Low',
      body.due || null,
      body.hours || 0,
      body.risk || 'green',
      body.status || 'Pending',
      user.id
    );
    logAudit(teamId, user.id, user.username, 'added', 'task', id, body.title);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/tasks/:id', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const tid = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(tid);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // IC can only update their own tasks
  if (isIC(req) && task.mid !== user.memberId) {
    return res.status(403).json({ error: 'You can only edit your own tasks' });
  }
  // Leader can only update tasks in their team
  if (isLeader(req) && task.team_id !== user.teamId) {
    return res.status(403).json({ error: 'Task not in your team' });
  }

  const body = req.body;
  try {
    db.prepare(`
      UPDATE tasks SET
        title = COALESCE(?, title),
        mid = COALESCE(?, mid),
        pid = ?,
        priority = COALESCE(?, priority),
        bp = COALESCE(?, bp),
        reg = COALESCE(?, reg),
        due = ?,
        hours = COALESCE(?, hours),
        risk = COALESCE(?, risk),
        status = COALESCE(?, status)
      WHERE id = ?
    `).run(
      body.title, body.mid,
      body.pid !== undefined ? body.pid : task.pid,
      body.priority, body.bp, body.reg,
      body.due !== undefined ? body.due : task.due,
      body.hours, body.risk, body.status,
      tid
    );
    logAudit(task.team_id, user.id, user.username, 'updated', 'task', tid, body.title || task.title);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/tasks/:id', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const tid = req.params.id;
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(tid);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (isIC(req) && task.mid !== user.memberId) {
    return res.status(403).json({ error: 'You can only delete your own tasks' });
  }
  if (isLeader(req) && task.team_id !== user.teamId) {
    return res.status(403).json({ error: 'Task not in your team' });
  }

  db.prepare('DELETE FROM tasks WHERE id = ?').run(tid);
  logAudit(task.team_id, user.id, user.username, 'deleted', 'task', tid, task.title);
  res.json({ ok: true });
});

// ─── PROJECTS ─────────────────────────────────────────────────────────────────
router.post('/projects', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const teamId = user.teamId;
  const body = req.body;
  const id = body.id || ('P' + Date.now());

  try {
    db.prepare(`
      INSERT INTO projects (id, team_id, name, desc, bp, reg, status, color, deadline, biz_function, owner, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, teamId,
      body.name, body.desc || null,
      body.bp || 3, body.reg || 'Medium',
      body.status || 'Active',
      body.color || '#4f8ef7',
      body.deadline || null,
      body.bizFunction || null,
      body.owner || null,
      user.id
    );

    if (Array.isArray(body.stakeholders)) {
      const insertSH = db.prepare('INSERT INTO project_stakeholders (project_id, name, role) VALUES (?, ?, ?)');
      for (const s of body.stakeholders) {
        if (s.name) insertSH.run(id, s.name, s.role || null);
      }
    }

    logAudit(teamId, user.id, user.username, 'added', 'project', id, body.name);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/projects/:id', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const pid = req.params.id;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (isIC(req) && project.created_by !== user.id) {
    return res.status(403).json({ error: 'You can only edit projects you created' });
  }
  if (isLeader(req) && project.team_id !== user.teamId) {
    return res.status(403).json({ error: 'Project not in your team' });
  }

  const body = req.body;
  try {
    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        desc = COALESCE(?, desc),
        bp = COALESCE(?, bp),
        reg = COALESCE(?, reg),
        status = COALESCE(?, status),
        color = COALESCE(?, color),
        deadline = ?,
        biz_function = COALESCE(?, biz_function),
        owner = ?
      WHERE id = ?
    `).run(
      body.name, body.desc, body.bp, body.reg,
      body.status, body.color,
      body.deadline !== undefined ? body.deadline : project.deadline,
      body.bizFunction,
      body.owner !== undefined ? body.owner : project.owner,
      pid
    );

    // Update stakeholders if provided
    if (Array.isArray(body.stakeholders)) {
      db.prepare('DELETE FROM project_stakeholders WHERE project_id = ?').run(pid);
      const insertSH = db.prepare('INSERT INTO project_stakeholders (project_id, name, role) VALUES (?, ?, ?)');
      for (const s of body.stakeholders) {
        if (s.name) insertSH.run(pid, s.name, s.role || null);
      }
    }

    logAudit(project.team_id, user.id, user.username, 'updated', 'project', pid, body.name || project.name);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/projects/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });

  const user = req.user;
  const pid = req.params.id;
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(pid);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.team_id !== user.teamId) return res.status(403).json({ error: 'Project not in your team' });

  db.prepare('DELETE FROM project_stakeholders WHERE project_id = ?').run(pid);
  db.prepare('DELETE FROM projects WHERE id = ?').run(pid);
  logAudit(project.team_id, user.id, user.username, 'deleted', 'project', pid, project.name);
  res.json({ ok: true });
});

// Stakeholders
router.post('/projects/:id/stakeholders', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const pid = req.params.id;
  const { name, role } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const result = db.prepare('INSERT INTO project_stakeholders (project_id, name, role) VALUES (?, ?, ?)').run(pid, name, role || null);
  res.json({ id: result.lastInsertRowid });
});

router.put('/projects/:id/stakeholders/:sid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { name, role } = req.body;
  db.prepare('UPDATE project_stakeholders SET name = COALESCE(?, name), role = COALESCE(?, role) WHERE id = ?')
    .run(name, role, req.params.sid);
  res.json({ ok: true });
});

router.delete('/projects/:id/stakeholders/:sid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM project_stakeholders WHERE id = ?').run(req.params.sid);
  res.json({ ok: true });
});

// ─── RISKS ────────────────────────────────────────────────────────────────────
router.post('/risks', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const teamId = user.teamId;
  const body = req.body;

  if (isIC(req) && body.owner !== user.memberId) {
    return res.status(403).json({ error: 'ICs can only create risks they own' });
  }

  const id = body.id || ('R' + Date.now());
  try {
    db.prepare(`
      INSERT INTO risks (id, team_id, title, pid, owner, severity, status, mitigation, identified, due, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, teamId,
      body.title, body.pid || null, body.owner || null,
      body.severity || 'Medium',
      body.status || 'Open',
      body.mitigation || null,
      body.identified || new Date().toISOString().split('T')[0],
      body.due || null,
      body.notes || null,
      user.id
    );
    logAudit(teamId, user.id, user.username, 'added', 'risk', id, body.title);
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/risks/:id', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });

  const user = req.user;
  const rid = req.params.id;
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(rid);
  if (!risk) return res.status(404).json({ error: 'Risk not found' });

  if (isIC(req) && risk.owner !== user.memberId) {
    return res.status(403).json({ error: 'You can only edit risks you own' });
  }
  if (isLeader(req) && risk.team_id !== user.teamId) {
    return res.status(403).json({ error: 'Risk not in your team' });
  }

  const body = req.body;
  try {
    db.prepare(`
      UPDATE risks SET
        title = COALESCE(?, title),
        pid = COALESCE(?, pid),
        owner = COALESCE(?, owner),
        severity = COALESCE(?, severity),
        status = COALESCE(?, status),
        mitigation = COALESCE(?, mitigation),
        due = ?,
        notes = COALESCE(?, notes)
      WHERE id = ?
    `).run(
      body.title, body.pid, body.owner,
      body.severity, body.status, body.mitigation,
      body.due !== undefined ? body.due : risk.due,
      body.notes, rid
    );
    logAudit(risk.team_id, user.id, user.username, 'updated', 'risk', rid, body.title || risk.title);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/risks/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });

  const user = req.user;
  const rid = req.params.id;
  const risk = db.prepare('SELECT * FROM risks WHERE id = ?').get(rid);
  if (!risk) return res.status(404).json({ error: 'Risk not found' });
  if (risk.team_id !== user.teamId) return res.status(403).json({ error: 'Risk not in your team' });

  db.prepare('DELETE FROM risks WHERE id = ?').run(rid);
  logAudit(risk.team_id, user.id, user.username, 'deleted', 'risk', rid, risk.title);
  res.json({ ok: true });
});

// ─── MEMBERS ─────────────────────────────────────────────────────────────────
router.post('/members', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });

  const user = req.user;
  const body = req.body;
  const id = body.id || ('M' + Date.now());

  // Generate username: first initial + last name, lowercased (e.g. "Sarah Chen" → "s.chen")
  const nameParts = body.name.trim().split(/\s+/);
  const firstName = nameParts[0] || '';
  const lastName = nameParts.slice(1).join('') || nameParts[0];
  const baseUsername = (firstName[0] + '.' + lastName).toLowerCase().replace(/[^a-z0-9.]/g, '');
  // Ensure uniqueness by appending a number if needed
  let username = baseUsername;
  let suffix = 2;
  while (db.prepare('SELECT id FROM users WHERE username = ?').get(username)) {
    username = baseUsername + suffix++;
  }
  const defaultPassword = '1234';
  const passwordHash = bcrypt.hashSync(defaultPassword, 10);

  try {
    db.prepare(`
      INSERT INTO members (id, team_id, name, initials, role_title, color, weekly_capacity)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, user.teamId,
      body.name, body.initials || body.name.slice(0, 2).toUpperCase(),
      body.role || body.role_title || 'Team Member',
      body.color || '#4f8ef7',
      body.weeklyCapacity || 40
    );
    db.prepare(`
      INSERT INTO users (username, password_hash, role, team_id, member_id)
      VALUES (?, ?, 'ic', ?, ?)
    `).run(username, passwordHash, user.teamId, id);
    logAudit(user.teamId, user.id, user.username, 'added', 'member', id, body.name);
    res.json({ id, username, password: defaultPassword });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/members/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });

  const user = req.user;
  const mid = req.params.id;
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND team_id = ?').get(mid, user.teamId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  const body = req.body;
  try {
    db.prepare(`
      UPDATE members SET
        name = COALESCE(?, name),
        initials = COALESCE(?, initials),
        role_title = COALESCE(?, role_title),
        color = COALESCE(?, color),
        weekly_capacity = COALESCE(?, weekly_capacity)
      WHERE id = ? AND team_id = ?
    `).run(
      body.name,
      body.initials,
      body.role || body.role_title,
      body.color,
      body.weeklyCapacity,
      mid, user.teamId
    );
    logAudit(user.teamId, user.id, user.username, 'updated', 'member', mid, body.name || member.name);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/members/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });

  const user = req.user;
  const mid = req.params.id;
  const member = db.prepare('SELECT * FROM members WHERE id = ? AND team_id = ?').get(mid, user.teamId);
  if (!member) return res.status(404).json({ error: 'Member not found' });

  db.prepare('DELETE FROM members WHERE id = ?').run(mid);
  db.prepare('DELETE FROM users WHERE member_id = ?').run(mid);
  logAudit(user.teamId, user.id, user.username, 'deleted', 'member', mid, member.name);
  res.json({ ok: true });
});

// ─── GOALS ────────────────────────────────────────────────────────────────────
router.post('/members/:id/goals', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });
  const user = req.user;
  const mid = req.params.id;
  if (isIC(req) && mid !== user.memberId) return res.status(403).json({ error: 'Access denied' });

  const teamId = user.teamId;
  const { title } = req.body;
  if (!title) return res.status(400).json({ error: 'Title required' });

  const result = db.prepare('INSERT INTO goals (member_id, team_id, title) VALUES (?, ?, ?)').run(mid, teamId, title);
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/goals/:gid', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });
  const user = req.user;
  const mid = req.params.id;
  if (isIC(req) && mid !== user.memberId) return res.status(403).json({ error: 'Access denied' });

  const { title } = req.body;
  db.prepare('UPDATE goals SET title = ? WHERE id = ?').run(title, req.params.gid);
  res.json({ ok: true });
});

router.delete('/members/:id/goals/:gid', (req, res) => {
  if (isGuestLeader(req)) return res.status(403).json({ error: 'Read-only access' });
  const user = req.user;
  const mid = req.params.id;
  if (isIC(req) && mid !== user.memberId) return res.status(403).json({ error: 'Access denied' });

  db.prepare('DELETE FROM goals WHERE id = ?').run(req.params.gid);
  res.json({ ok: true });
});

// ─── STRENGTHS ────────────────────────────────────────────────────────────────
router.post('/members/:id/strengths', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const mid = req.params.id;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const result = db.prepare('INSERT INTO member_strengths (member_id, team_id, text) VALUES (?, ?, ?)').run(mid, req.user.teamId, text);
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/strengths/:sid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { text } = req.body;
  db.prepare('UPDATE member_strengths SET text = ? WHERE id = ?').run(text, req.params.sid);
  res.json({ ok: true });
});

router.delete('/members/:id/strengths/:sid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM member_strengths WHERE id = ?').run(req.params.sid);
  res.json({ ok: true });
});

// ─── GROWTH ───────────────────────────────────────────────────────────────────
router.post('/members/:id/growth', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const mid = req.params.id;
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const result = db.prepare('INSERT INTO member_growth (member_id, team_id, text) VALUES (?, ?, ?)').run(mid, req.user.teamId, text);
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/growth/:gid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { text } = req.body;
  db.prepare('UPDATE member_growth SET text = ? WHERE id = ?').run(text, req.params.gid);
  res.json({ ok: true });
});

router.delete('/members/:id/growth/:gid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM member_growth WHERE id = ?').run(req.params.gid);
  res.json({ ok: true });
});

// ─── NOTES LOG (leader only) ──────────────────────────────────────────────────
router.post('/members/:id/notes', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const mid = req.params.id;
  const { text, datetime } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const dt = datetime || new Date().toISOString();
  const result = db.prepare('INSERT INTO notes_log (member_id, team_id, datetime, text) VALUES (?, ?, ?, ?)').run(mid, req.user.teamId, dt, text);
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/notes/:nid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { text, datetime } = req.body;
  db.prepare('UPDATE notes_log SET text = COALESCE(?, text), datetime = COALESCE(?, datetime) WHERE id = ?').run(text, datetime, req.params.nid);
  res.json({ ok: true });
});

router.delete('/members/:id/notes/:nid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM notes_log WHERE id = ?').run(req.params.nid);
  res.json({ ok: true });
});

// ─── COACHING LOG (leader only) ───────────────────────────────────────────────
router.post('/members/:id/coaching', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const mid = req.params.id;
  const { note, date } = req.body;
  if (!note) return res.status(400).json({ error: 'Note required' });
  const d = date || new Date().toISOString().split('T')[0];
  const result = db.prepare('INSERT INTO coaching_log (member_id, team_id, date, note) VALUES (?, ?, ?, ?)').run(mid, req.user.teamId, d, note);
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/coaching/:cid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { note, date } = req.body;
  db.prepare('UPDATE coaching_log SET note = COALESCE(?, note), date = COALESCE(?, date) WHERE id = ?').run(note, date, req.params.cid);
  res.json({ ok: true });
});

router.delete('/members/:id/coaching/:cid', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM coaching_log WHERE id = ?').run(req.params.cid);
  res.json({ ok: true });
});

// ─── DECISION LOG (leader only) ───────────────────────────────────────────────
router.post('/members/:id/decisions', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const mid = req.params.id;
  const { decision, rationale, date } = req.body;
  if (!decision) return res.status(400).json({ error: 'Decision required' });
  const d = date || new Date().toISOString().split('T')[0];
  const result = db.prepare('INSERT INTO decision_log (member_id, team_id, date, decision, rationale) VALUES (?, ?, ?, ?, ?)').run(mid, req.user.teamId, d, decision, rationale || '—');
  res.json({ id: result.lastInsertRowid });
});

router.put('/members/:id/decisions/:did', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { decision, rationale } = req.body;
  db.prepare('UPDATE decision_log SET decision = COALESCE(?, decision), rationale = COALESCE(?, rationale) WHERE id = ?').run(decision, rationale, req.params.did);
  res.json({ ok: true });
});

router.delete('/members/:id/decisions/:did', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM decision_log WHERE id = ?').run(req.params.did);
  res.json({ ok: true });
});

// ─── TEAM NOTES (leader only) ─────────────────────────────────────────────────
router.post('/team-notes', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const user = req.user;
  const { text, title, datetime, attendees } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const dt = datetime || new Date().toISOString();
  const att = Array.isArray(attendees) ? JSON.stringify(attendees) : (attendees || null);
  const result = db.prepare('INSERT INTO team_notes (team_id, datetime, title, text, attendees) VALUES (?, ?, ?, ?, ?)').run(user.teamId, dt, title || null, text, att);
  res.json({ id: result.lastInsertRowid });
});

router.put('/team-notes/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { text, title } = req.body;
  db.prepare('UPDATE team_notes SET text = COALESCE(?, text), title = COALESCE(?, title) WHERE id = ?').run(text, title, req.params.id);
  res.json({ ok: true });
});

router.delete('/team-notes/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM team_notes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── MEETING MINUTES (leader only) ────────────────────────────────────────────
router.post('/meeting-minutes', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const user = req.user;
  const { text, title, datetime, attendees, actionItems, category, projectId, external } = req.body;
  if (!text) return res.status(400).json({ error: 'Text required' });
  const dt = datetime || new Date().toISOString();
  const att = Array.isArray(attendees) ? JSON.stringify(attendees) : (attendees || null);
  const result = db.prepare('INSERT INTO meeting_minutes (team_id, datetime, title, text, attendees) VALUES (?, ?, ?, ?, ?)').run(user.teamId, dt, title || null, text, att);
  res.json({ id: result.lastInsertRowid });
});

router.put('/meeting-minutes/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const { text, title } = req.body;
  db.prepare('UPDATE meeting_minutes SET text = COALESCE(?, text), title = COALESCE(?, title) WHERE id = ?').run(text, title, req.params.id);
  res.json({ ok: true });
});

router.delete('/meeting-minutes/:id', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  db.prepare('DELETE FROM meeting_minutes WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── AUDIT LOG ────────────────────────────────────────────────────────────────
router.get('/audit', (req, res) => {
  if (!isLeader(req)) return res.status(403).json({ error: 'Leader access required' });
  const entries = db.prepare(`
    SELECT * FROM audit_log WHERE team_id = ?
    ORDER BY timestamp DESC LIMIT 100
  `).all(req.user.teamId);
  res.json(entries);
});

module.exports = router;
