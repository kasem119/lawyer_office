import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateToken, (req, res, next) => {
  try {
    const query = req.query.q;
    if (!query || query.trim() === '') {
      return res.json({ success: true, data: { cases: [], clients: [], tasks: [], events: [] } });
    }

    const likeQuery = `%${query}%`;
    const userId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    let cases = [];
    let clients = [];
    let tasks = [];
    let events = [];

    // Search Cases
    if (isAdmin) {
      cases = db.prepare(`
        SELECT id, title, case_number, status, case_type 
        FROM cases 
        WHERE title LIKE ? OR case_number LIKE ? OR description LIKE ? OR court_name LIKE ?
        LIMIT 10
      `).all(likeQuery, likeQuery, likeQuery, likeQuery);
    } else {
      cases = db.prepare(`
        SELECT DISTINCT c.id, c.title, c.case_number, c.status, c.case_type 
        FROM cases c
        LEFT JOIN case_lawyers cl ON c.id = cl.case_id
        WHERE (c.title LIKE ? OR c.case_number LIKE ? OR c.description LIKE ? OR c.court_name LIKE ?)
        AND (c.lead_lawyer_id = ? OR cl.user_id = ?)
        LIMIT 10
      `).all(likeQuery, likeQuery, likeQuery, likeQuery, userId, userId);
    }

    // Search Clients (Assuming lawyers can see all clients for simplicity, or we can just limit)
    clients = db.prepare(`
      SELECT id, name, phone, email 
      FROM clients 
      WHERE name LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?
      LIMIT 10
    `).all(likeQuery, likeQuery, likeQuery, likeQuery);

    // Search Tasks
    if (isAdmin) {
      tasks = db.prepare(`
        SELECT id, title, status, due_date 
        FROM tasks 
        WHERE title LIKE ? OR description LIKE ?
        LIMIT 10
      `).all(likeQuery, likeQuery);
    } else {
      tasks = db.prepare(`
        SELECT id, title, status, due_date 
        FROM tasks 
        WHERE (title LIKE ? OR description LIKE ?)
        AND assigned_to = ?
        LIMIT 10
      `).all(likeQuery, likeQuery, userId);
    }

    // Search Events
    if (isAdmin) {
      events = db.prepare(`
        SELECT id, title, date, location 
        FROM events 
        WHERE title LIKE ? OR description LIKE ? OR location LIKE ?
        LIMIT 10
      `).all(likeQuery, likeQuery, likeQuery);
    } else {
      events = db.prepare(`
        SELECT id, title, date, location 
        FROM events 
        WHERE (title LIKE ? OR description LIKE ? OR location LIKE ?)
        AND user_id = ?
        LIMIT 10
      `).all(likeQuery, likeQuery, likeQuery, userId);
    }

    res.json({
      success: true,
      data: {
        cases,
        clients,
        tasks,
        events
      }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
