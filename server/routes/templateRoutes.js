import express from 'express';
import db from '../database/db.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();
router.use(authenticateToken);

const VALID_CATEGORIES = ['contract', 'power_of_attorney', 'letter', 'motion', 'memo', 'other'];

// Helper to extract {{placeholder}} tags from HTML content
function extractPlaceholders(contentHtml) {
  if (!contentHtml) return [];
  const regex = /\{\{([^}]+)\}\}/g;
  const matches = new Set();
  let match;
  while ((match = regex.exec(contentHtml)) !== null) {
    const key = match[1].trim();
    if (key) {
      matches.add(key);
    }
  }
  return Array.from(matches);
}

// GET /api/templates - Get all document templates (optional ?category= filter)
router.get('/', (req, res, next) => {
  try {
    const { category } = req.query;
    let sql = `
      SELECT t.*, u.name as created_by_name
      FROM document_templates t
      JOIN users u ON t.created_by = u.id
    `;
    const params = [];

    if (category && VALID_CATEGORIES.includes(category)) {
      sql += ` WHERE t.category = ?`;
      params.push(category);
    }

    sql += ` ORDER BY t.id DESC`;

    const templates = db.prepare(sql).all(...params);

    // Format placeholders if stored as JSON string
    const formattedTemplates = templates.map(t => {
      let placeholders = [];
      if (t.placeholders_json) {
        try {
          placeholders = typeof t.placeholders_json === 'string' 
            ? JSON.parse(t.placeholders_json) 
            : t.placeholders_json;
        } catch (e) {
          placeholders = extractPlaceholders(t.content_html);
        }
      } else {
        placeholders = extractPlaceholders(t.content_html);
      }
      return {
        ...t,
        placeholders
      };
    });

    res.json({
      success: true,
      templates: formattedTemplates
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/templates/:id - Get single template by ID
router.get('/:id', (req, res, next) => {
  try {
    const template = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM document_templates t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(req.params.id);

    if (!template) {
      return res.status(404).json({ success: false, message: 'القالب غير موجود' });
    }

    let placeholders = [];
    if (template.placeholders_json) {
      try {
        placeholders = typeof template.placeholders_json === 'string'
          ? JSON.parse(template.placeholders_json)
          : template.placeholders_json;
      } catch (e) {
        placeholders = extractPlaceholders(template.content_html);
      }
    } else {
      placeholders = extractPlaceholders(template.content_html);
    }

    res.json({
      success: true,
      template: {
        ...template,
        placeholders
      }
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates - Create a new document template
router.post('/', (req, res, next) => {
  try {
    const { name, category = 'other', content_html, placeholders_json } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'اسم القالب مطلوب' });
    }

    if (!content_html || !content_html.trim()) {
      return res.status(400).json({ success: false, message: 'محتوى القالب مطلوب' });
    }

    const validCategory = VALID_CATEGORIES.includes(category) ? category : 'other';

    // Format or extract placeholders
    let parsedPlaceholders = [];
    if (placeholders_json) {
      if (typeof placeholders_json === 'string') {
        try {
          parsedPlaceholders = JSON.parse(placeholders_json);
        } catch (e) {
          parsedPlaceholders = extractPlaceholders(content_html);
        }
      } else if (Array.isArray(placeholders_json)) {
        parsedPlaceholders = placeholders_json;
      }
    } else {
      parsedPlaceholders = extractPlaceholders(content_html);
    }

    const finalPlaceholdersJson = JSON.stringify(parsedPlaceholders);

    const stmt = db.prepare(`
      INSERT INTO document_templates (name, category, content_html, placeholders_json, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      name.trim(),
      validCategory,
      content_html,
      finalPlaceholdersJson,
      req.user.id
    );

    const createdTemplate = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM document_templates t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({
      success: true,
      message: 'تم إنشاء القالب بنجاح',
      template: {
        ...createdTemplate,
        placeholders: parsedPlaceholders
      }
    });
  } catch (err) {
    next(err);
  }
});

// PUT /api/templates/:id - Update an existing template
router.put('/:id', (req, res, next) => {
  try {
    const { name, category, content_html, placeholders_json } = req.body;
    const templateId = req.params.id;

    const existing = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(templateId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'القالب غير موجود' });
    }

    const updatedName = name && name.trim() ? name.trim() : existing.name;
    const updatedCategory = category && VALID_CATEGORIES.includes(category) ? category : existing.category;
    const updatedContent = content_html !== undefined ? content_html : existing.content_html;

    let updatedPlaceholders = [];
    if (placeholders_json !== undefined) {
      if (typeof placeholders_json === 'string') {
        try {
          updatedPlaceholders = JSON.parse(placeholders_json);
        } catch (e) {
          updatedPlaceholders = extractPlaceholders(updatedContent);
        }
      } else if (Array.isArray(placeholders_json)) {
        updatedPlaceholders = placeholders_json;
      }
    } else {
      updatedPlaceholders = extractPlaceholders(updatedContent);
    }

    const finalPlaceholdersJson = JSON.stringify(updatedPlaceholders);

    db.prepare(`
      UPDATE document_templates
      SET name = ?, category = ?, content_html = ?, placeholders_json = ?
      WHERE id = ?
    `).run(updatedName, updatedCategory, updatedContent, finalPlaceholdersJson, templateId);

    const updatedTemplate = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM document_templates t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(templateId);

    res.json({
      success: true,
      message: 'تم تحديث القالب بنجاح',
      template: {
        ...updatedTemplate,
        placeholders: updatedPlaceholders
      }
    });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/templates/:id - Delete a document template
router.delete('/:id', (req, res, next) => {
  try {
    const templateId = req.params.id;
    const existing = db.prepare('SELECT * FROM document_templates WHERE id = ?').get(templateId);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'القالب غير موجود' });
    }

    db.prepare('DELETE FROM document_templates WHERE id = ?').run(templateId);

    res.json({
      success: true,
      message: 'تم حذف القالب بنجاح'
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/templates/:id/generate - Generate document from template with placeholder values
router.post('/:id/generate', (req, res, next) => {
  try {
    const templateId = req.params.id;
    const template = db.prepare(`
      SELECT t.*, u.name as created_by_name
      FROM document_templates t
      JOIN users u ON t.created_by = u.id
      WHERE t.id = ?
    `).get(templateId);

    if (!template) {
      return res.status(404).json({ success: false, message: 'القالب غير موجود' });
    }

    const values = req.body.values || req.body.placeholders || req.body || {};

    // Replace all {{placeholder}} occurrences with provided values
    let generatedHtml = template.content_html;
    
    // Support regex replacement for {{key}} and {{ key }}
    generatedHtml = generatedHtml.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (fullMatch, key) => {
      const trimmedKey = key.trim();
      if (values[trimmedKey] !== undefined && values[trimmedKey] !== null && String(values[trimmedKey]).trim() !== '') {
        return String(values[trimmedKey]);
      }
      return fullMatch; // Keep placeholder if no value supplied
    });

    res.json({
      success: true,
      template_id: template.id,
      template_name: template.name,
      category: template.category,
      generated_html: generatedHtml,
      values_used: values,
      generated_at: new Date().toISOString()
    });
  } catch (err) {
    next(err);
  }
});

export default router;
