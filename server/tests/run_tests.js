import app from '../index.js';
import request from 'supertest';

async function run() {
  console.log('🚀 بدء الفحص الشامل لمنظومة مكتب المحاماة...\n');

  let passed = 0;
  let failed = 0;

  async function testCase(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
      failed++;
    }
  }

  // 1. Health check
  await testCase('GET /api/health returns ok status', async () => {
    const res = await request(app).get('/api/health');
    if (res.status !== 200 || res.body.status !== 'ok') throw new Error(`Unexpected: ${res.status}`);
  });

  // 2. Discovery
  await testCase('GET /api/discovery returns server metadata', async () => {
    const res = await request(app).get('/api/discovery');
    if (res.status !== 200 || res.body.signature !== 'lawyer-office-server') throw new Error(`Invalid discovery signature`);
  });

  // 3. Admin Login
  let adminToken = '';
  await testCase('POST /api/auth/login logs in admin', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@lawyer.com', password: 'admin123' });
    if (res.status !== 200 || !res.body.accessToken) throw new Error(`Admin login failed: ${res.status}`);
    adminToken = res.body.accessToken;
  });

  // 4. Ensure lawyer user exists & log in
  let lawyerToken = '';
  await testCase('Setup & login lawyer account', async () => {
    const usersRes = await request(app).get('/api/users').set('Authorization', `Bearer ${adminToken}`);
    const users = usersRes.body.users || [];
    let lawyer = users.find(u => u.email === 'lawyer@lawyer.com');
    if (!lawyer) {
      await request(app)
        .post('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'أ. سارة محمود (محامية)',
          email: 'lawyer@lawyer.com',
          password: 'LawyerSecret123!',
          role: 'lawyer'
        });
    }

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'lawyer@lawyer.com', password: 'LawyerSecret123!' });
    if (loginRes.status !== 200 || !loginRes.body.accessToken) {
      throw new Error(`Lawyer login failed: ${loginRes.status}`);
    }
    lawyerToken = loginRes.body.accessToken;
  });

  // 5. Lawyer profile & change password
  await testCase('GET /api/users/profile & PUT /api/users/profile', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${lawyerToken}`);
    if (res.status !== 200 || !res.body.user) throw new Error(`Profile fetch failed`);

    const updateRes = await request(app)
      .put('/api/users/profile')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({ name: 'أ. سارة محمود (محامية معتمدة)' });
    if (updateRes.status !== 200) throw new Error(`Profile update failed`);
  });

  // 6. Documents unified route with pagination & search
  await testCase('GET /api/documents returns paginated documents', async () => {
    const res = await request(app)
      .get('/api/documents?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    if (res.status !== 200 || !Array.isArray(res.body.documents)) throw new Error(`Status ${res.status}`);
  });

  // 7. Conflict Check with Opponent and Hashed ID
  await testCase('POST /api/conflict/check detects opponents and parties', async () => {
    const res = await request(app)
      .post('/api/conflict/check')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'سالم' });
    if (res.status !== 200 || !res.body.conflicts) throw new Error(`Conflict check failed`);
  });

  // 8. Financial Summary (accessible to both Admin & Lawyer)
  await testCase('GET /api/reports/financial-summary returns financial KPIs for lawyer', async () => {
    const res = await request(app)
      .get('/api/reports/financial-summary')
      .set('Authorization', `Bearer ${lawyerToken}`);
    if (res.status !== 200 || typeof res.body.data.net_profit !== 'number') throw new Error(`Report failed`);
  });

  // 9. AI Legal Assistant
  await testCase('POST /api/ai/assist drafts arbitration clause', async () => {
    const res = await request(app)
      .post('/api/ai/assist')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({
        mode: 'draft_clause',
        prompt: 'صياغة شرط التحكيم وفض المنازعات'
      });
    if (res.status !== 200 || !res.body.data.content.includes('التحكيم')) throw new Error(`AI assist failed`);
  });

  // 10. Client Portal
  await testCase('POST /api/portal/login validates unregistered client', async () => {
    const res = await request(app)
      .post('/api/portal/login')
      .send({ identifier: '0000000000' });
    if (res.status !== 404) throw new Error(`Expected 404, got ${res.status}`);
  });

  // 11. Invoice Full Lifecycle (Create, Edit with Transaction, Send Email)
  let testInvoiceId = null;
  await testCase('POST & PUT /api/invoices and POST /api/invoices/:id/send-email', async () => {
    // Ensure a client exists
    let clientRes = await request(app).get('/api/clients').set('Authorization', `Bearer ${adminToken}`);
    let clients = clientRes.body.clients || [];
    let clientId = clients[0]?.id;
    if (!clientId) {
      const newClientRes = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'شركة الأفق للاستشارات',
          email: 'client@horizon.com',
          phone: '0912345678',
          national_id: '119900123456'
        });
      clientId = newClientRes.body.clientId || newClientRes.body.id;
    }

    // Ensure a case exists
    let caseRes = await request(app).get('/api/cases').set('Authorization', `Bearer ${adminToken}`);
    let cases = caseRes.body.cases || [];
    let caseId = cases[0]?.id;
    if (!caseId) {
      const newCaseRes = await request(app)
        .post('/api/cases')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          case_number: `CASE-${Date.now()}`,
          title: 'قضية التحكيم التجاري',
          client_id: clientId,
          case_type: 'commercial'
        });
      caseId = newCaseRes.body.caseId || newCaseRes.body.id;
    }

    // Create Invoice
    const createRes = await request(app)
      .post('/api/invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        case_id: caseId,
        client_id: clientId,
        due_date: '2026-12-31',
        notes: 'فاتورة استشارة قانونية تجريبية',
        items: [
          { description: 'صياغة عقد', quantity: 1, unit_price: 500 },
          { description: 'جلسة استشارية', quantity: 2, unit_price: 150 }
        ]
      });
    if (createRes.status !== 200 || !createRes.body.data?.id) throw new Error(`Invoice creation failed: ${createRes.body.message || createRes.status}`);
    testInvoiceId = createRes.body.data.id;

    // Edit Invoice via PUT /api/invoices/:id
    const editRes = await request(app)
      .put(`/api/invoices/${testInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        notes: 'فاتورة محدثة - تشمل جلسة إضافية',
        items: [
          { description: 'صياغة عقد تجاري', quantity: 1, unit_price: 700 },
          { description: 'جلسة استشارية عليا', quantity: 1, unit_price: 300 }
        ]
      });
    if (editRes.status !== 200) throw new Error(`Invoice edit failed: ${editRes.body.message || editRes.status}`);

    // Send Email via POST /api/invoices/:id/send-email
    const emailRes = await request(app)
      .post(`/api/invoices/${testInvoiceId}/send-email`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send();
    if (emailRes.status !== 200 || !emailRes.body.success) throw new Error(`Invoice email dispatch failed`);
  });

  // 12. Event Full Lifecycle (Create, Update, Delete)
  await testCase('POST, PUT, DELETE /api/events', async () => {
    // Create
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({
        title: 'جلسة محكمة الاستئناف - فحص اختباري',
        event_type: 'court_date',
        date: '2026-10-15',
        time: '10:00',
        end_time: '11:30',
        location: 'محكمة شمال طرابلس الابتدائية'
      });
    if (createRes.status !== 201 || !createRes.body.eventId) throw new Error(`Event creation failed`);
    const eventId = createRes.body.eventId;

    // Update
    const updateRes = await request(app)
      .put(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${lawyerToken}`)
      .send({
        title: 'جلسة محكمة الاستئناف - تأجيل المرافعة',
        date: '2026-10-22',
        time: '11:00'
      });
    if (updateRes.status !== 200) throw new Error(`Event update failed`);

    // Delete
    const deleteRes = await request(app)
      .delete(`/api/events/${eventId}`)
      .set('Authorization', `Bearer ${lawyerToken}`);
    if (deleteRes.status !== 200) throw new Error(`Event deletion failed`);
  });

  // 13. Task Full Lifecycle (Create, Update, Status Kanban, Delete)
  await testCase('POST, PUT, DELETE /api/tasks and status update', async () => {
    // Get user id for assignment
    const meRes = await request(app).get('/api/users/profile').set('Authorization', `Bearer ${adminToken}`);
    const adminUserId = meRes.body.user.id;

    // Create
    const createRes = await request(app)
      .post('/api/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'إعداد مذكرة الدفاع النهائية',
        assigned_to: adminUserId,
        priority: 'urgent',
        due_date: '2026-10-01'
      });
    if (createRes.status !== 201 || !createRes.body.taskId) throw new Error(`Task creation failed: ${createRes.body.message || createRes.status}`);
    const taskId = createRes.body.taskId;

    // Update Status (Kanban drag-and-drop)
    const statusRes = await request(app)
      .put(`/api/tasks/${taskId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    if (statusRes.status !== 200) throw new Error(`Task status update failed`);

    // Edit Task
    const editRes = await request(app)
      .put(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'مراجعة واعتماد مذكرة الدفاع النهائية',
        assigned_to: adminUserId,
        priority: 'high'
      });
    if (editRes.status !== 200) throw new Error(`Task edit failed`);

    // Delete Task
    const deleteRes = await request(app)
      .delete(`/api/tasks/${taskId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    if (deleteRes.status !== 200) throw new Error(`Task deletion failed`);
  });

  console.log(`\n====================================================`);
  console.log(`📊 النتيجة النهائية: ${passed} ناجح / ${failed} فاشل`);
  console.log(`====================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

run();
