import bcrypt from 'bcryptjs';
import db from './db.js';

export function seedDatabase() {
  const seedDemoData = process.env.SEED_DEMO_DATA === 'true' || process.env.NODE_ENV === 'test';
  const existingAdmin = db.prepare('SELECT * FROM users WHERE email = ?').get('admin@lawyer.com');
  if (seedDemoData && !existingAdmin) {
    const adminHash = bcrypt.hashSync('admin123', 10);
    const lawyerHash = bcrypt.hashSync('lawyer123', 10);

    const insertUser = db.prepare(`
      INSERT INTO users (name, email, password_hash, role, phone)
      VALUES (?, ?, ?, ?, ?)
    `);

    const adminResult = insertUser.run('أ. أحمد المحامي (المدير)', 'admin@lawyer.com', adminHash, 'admin', '0912345678');
    const lawyerResult = insertUser.run('أ. سارة محمود (محامي)', 'lawyer@lawyer.com', lawyerHash, 'lawyer', '0923456789');

    console.log('✅ Seeded default admin and lawyer users successfully.');

    // Seed sample client
    const insertClient = db.prepare(`
      INSERT INTO clients (name, national_id_encrypted, phone, email, address, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const clientResult = insertClient.run('شركة الأمل للتجارة', '119850123456', '0911112222', 'info@alamal.com', 'طرابلس - شارع عمر المختار', 'عميل مميز - عقود وتجارية', adminResult.lastInsertRowid);

    // Seed sample case
    const insertCase = db.prepare(`
      INSERT INTO cases (case_number, title, description, court_name, case_type, status, priority, client_id, lead_lawyer_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const caseResult = insertCase.run(
      'CASE-2026-001',
      'قضية تحصيل مستحقات مالية - شركة الأمل ضد المورد',
      'دعوى تجارية للمطالبة بمبلغ 450,000 د.ل بموجب العقود المبرمة والإنذارات الرسمية',
      'محكمة شمال طرابلس الابتدائية',
      'تجاري',
      'active',
      'high',
      clientResult.lastInsertRowid,
      adminResult.lastInsertRowid
    );

    // Link lawyer to case
    const insertCaseLawyer = db.prepare(`
      INSERT INTO case_lawyers (case_id, user_id, role_in_case)
      VALUES (?, ?, ?)
    `);
    insertCaseLawyer.run(caseResult.lastInsertRowid, adminResult.lastInsertRowid, 'lead');
    insertCaseLawyer.run(caseResult.lastInsertRowid, lawyerResult.lastInsertRowid, 'assigned');

    // Seed sample event
    const insertEvent = db.prepare(`
      INSERT INTO events (title, description, event_type, date, time, location, case_id, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertEvent.run(
      'جلسة المرافعة الأولى',
      'تقديم المذكرة الشارحة والبيانات المستندية',
      'court_date',
      '2026-08-20',
      '09:30',
      'مجمع المحاكم طرابلس - القاعة 4',
      caseResult.lastInsertRowid,
      adminResult.lastInsertRowid
    );

    // Seed sample task
    const insertTask = db.prepare(`
      INSERT INTO tasks (title, description, status, priority, due_date, case_id, assigned_to, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertTask.run(
      'إعداد مذكرة الدعوى وتدقيق المستندات',
      'مراجعة عقود التوريد وإرفاق كشف الحساب المعتمد',
      'in_progress',
      'high',
      '2026-08-15',
      caseResult.lastInsertRowid,
      lawyerResult.lastInsertRowid,
      adminResult.lastInsertRowid
    );
  }

  // Ensure templates exist even if users already existed
  const templateCount = db.prepare('SELECT COUNT(*) as count FROM document_templates').get();
  if (templateCount.count === 0) {
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') || { id: 1 };
    const insertTemplate = db.prepare(`
      INSERT INTO document_templates (name, category, content_html, placeholders_json, created_by)
      VALUES (?, ?, ?, ?, ?)
    `);

    // 1. عقد تقديم أتعاب وخدمات قانونية
    insertTemplate.run(
      'عقد تقديم خدمات واستشارات قانونية',
      'contract',
      `<h2>عقد تقديم خدمات واستشارات قانونية</h2>
<p><strong>إنه في يوم:</strong> {{date}}</p>
<p><strong>تم الاتفاق بين كل من:</strong></p>
<p><strong>الطرف الأول (المحامي):</strong> {{lawyer_name}}، المقيد بنقابة المحامين، وعنوانه: {{office_address}}</p>
<p><strong>الطرف الثاني (الموكل):</strong> {{client_name}}، الرقم الوطني / السجل التجاري: {{client_id_number}}، المقيم في: {{client_address}}، الهاتف: {{client_phone}}</p>
<hr />
<h3>البند الأول: موضوع العقد</h3>
<p>يقوم الطرف الأول بتمثيل وتقديم الاستشارات والترافع نيابة عن الطرف الثاني في موضوع: <strong>{{contract_subject}}</strong> والخاص بـ {{case_description}}.</p>
<h3>البند الثاني: الأتعاب وطريقة السداد</h3>
<p>اتفق الطرفان على أن تكون أتعاب المحاماة الإجمالية مبلغاً وقدره: <strong>{{total_fees}} د.ل</strong> (فقط {{fees_written}})، تدفع كالتالي:</p>
<ul>
  <li>دفعة مقدمة قدرها: {{advance_payment}} د.ل عند توقيع هذا العقد.</li>
  <li>المبلغ المتبقي وقدره: {{remaining_payment}} د.ل عند صدور الحكم أو إتمام الإجراءات.</li>
</ul>
<h3>البند الثالث: التزامات الطرفين</h3>
<p>يلتزم الطرف الأول ببذل العناية المهنية الواجبة والمحافظة على سرية البيانات، كما يلتزم الطرف الثاني بتسليم المستندات في المواعيد المحددة وسداد المصاريف القضائية.</p>
<br /><br />
<table style="width: 100%; border: none;">
  <tr>
    <td style="text-align: right; width: 50%;"><strong>توقيع الطرف الأول (المحامي):</strong><br /><br />.............................</td>
    <td style="text-align: left; width: 50%;"><strong>توقيع الطرف الثاني (الموكل):</strong><br /><br />.............................</td>
  </tr>
</table>`,
      JSON.stringify(['date', 'lawyer_name', 'office_address', 'client_name', 'client_id_number', 'client_address', 'client_phone', 'contract_subject', 'case_description', 'total_fees', 'fees_written', 'advance_payment', 'remaining_payment']),
      adminUser.id
    );

    // 2. توكيل خاص بالتقاضي والمرافعة
    insertTemplate.run(
      'توكيل خاص بالتقاضي والمرافعة أمام المحاكم',
      'power_of_attorney',
      `<h2>توكيل خاص بالتقاضي والمرافعة</h2>
<p>أنا الموقع أدناه: <strong>{{client_name}}</strong>، حامل هوية / رقم وطني: <strong>{{client_id_number}}</strong>، المقيم في: {{client_address}}.</p>
<p>قد وكلت وأقمت مقامي الأستاذ المحامي: <strong>{{lawyer_name}}</strong>، في الحضور والتمثيل والترافع والدفاع عني أمام جميع المحاكم على اختلاف أنواعها ودرجاتها، وتحديداً في القضية رقم: <strong>{{case_number}}</strong> المقيدة أمام <strong>{{court_name}}</strong> ضد: <strong>{{opponent_name}}</strong>.</p>
<p>وللوكيل حق تقديم اللوائح والمذكرات، وسماع الشهود، والطعن بالتزوير، واستلام الأحكام والقرارات، وله حق توكيل الغير في كل أو بعض ما ذكر أعلاه.</p>
<br />
<p><strong>تحريراً في:</strong> {{date}}</p>
<br /><br />
<p style="text-align: left;"><strong>اسم وتوقيع الموكل:</strong> {{client_name}}<br /><br />.............................</p>`,
      JSON.stringify(['client_name', 'client_id_number', 'client_address', 'lawyer_name', 'case_number', 'court_name', 'opponent_name', 'date']),
      adminUser.id
    );

    // 3. إنذار قانوني رسمي
    insertTemplate.run(
      'إنذار قانوني رسمي بسداد مستحقات مالية',
      'letter',
      `<h2>إنذار رسمي على يد محضر</h2>
<p><strong>التاريخ:</strong> {{date}}</p>
<p><strong>بناءً على طلب السيد / شركة:</strong> {{client_name}}، المقيم في: {{client_address}}، ومحله المختار مكتب الأستاذ: {{lawyer_name}}.</p>
<p><strong>أنا المحضر قد أنذرت:</strong> السيد / شركة: <strong>{{opponent_name}}</strong>، المقيم في: {{opponent_address}}.</p>
<hr />
<h3>الموضوع والوقائع:</h3>
<p>حيث إن المنذَر إليه مدين للمنذِر بمبلغ وقدره: <strong>{{debt_amount}} د.ل</strong> بموجب {{debt_reason}} والمستحق الأداء بتاريخ {{due_date}}.</p>
<p>وحيث إنه رغم المطالبات الودية المتكررة لم يقم المنذَر إليه بالسداد حتى تاريخه.</p>
<h3>الإنذار:</h3>
<p>ننذر المنذَر إليه بضرورة سداد المبلغ كاملاً خلال مهلة أقصاها <strong>{{grace_period_days}} يوماً</strong> من تاريخ تسلم هذا الإنذار، وإلا سيضطر المنذِر لاتخاذ كافة الإجراءات القانونية والقضائية وتوقيع الحجوزات القانونية وإلزامه بالفوائد والمصاريف وأتعاب المحاماة.</p>
<br /><br />
<p style="text-align: left;"><strong>وكيل المنذر (المحامي):</strong> {{lawyer_name}}<br />.............................</p>`,
      JSON.stringify(['date', 'client_name', 'client_address', 'lawyer_name', 'opponent_name', 'opponent_address', 'debt_amount', 'debt_reason', 'due_date', 'grace_period_days']),
      adminUser.id
    );

    // 4. مذكرة دفاع ومرافعة
    insertTemplate.run(
      'مذكرة دفاع ودفوع ختامية أمام المحكمة',
      'motion',
      `<h2>مذكرة دفاع ختامية</h2>
<p><strong>أمام محكمة:</strong> {{court_name}}</p>
<p><strong>الدائرة:</strong> {{court_circuit}} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>جلسة يوم:</strong> {{hearing_date}}</p>
<p><strong>في الدعوى رقم:</strong> {{case_number}}</p>
<hr />
<p><strong>مقدمة من:</strong> {{client_name}} ({{client_role}} - بصفتنا وكيلاً عنه الأستاذ: {{lawyer_name}})</p>
<p><strong>ضـــد:</strong> {{opponent_name}} ({{opponent_role}})</p>
<hr />
<h3>أولاً: الوقائع الموجزة</h3>
<p>{{case_facts}}</p>
<h3>ثانياً: الدفوع وأسانيد الدفاع القانونية</h3>
<p>{{legal_defenses}}</p>
<h3>الطلبات الختامية:</h3>
<p>يلتمس الدفاع من الهيئة الموقرة الحكم بما يلي:</p>
<p>{{final_requests}}</p>
<br /><br />
<p style="text-align: left;"><strong>وكيل الدفاع (المحامي):</strong> {{lawyer_name}}<br />.............................</p>`,
      JSON.stringify(['court_name', 'court_circuit', 'hearing_date', 'case_number', 'client_name', 'client_role', 'lawyer_name', 'opponent_name', 'opponent_role', 'case_facts', 'legal_defenses', 'final_requests']),
      adminUser.id
    );

    console.log('✅ Seeded default document templates successfully.');
  }

  // Ensure activity logs exist for demo/initial view
  const activityCount = db.prepare('SELECT COUNT(*) as count FROM activity_log').get();
  if (activityCount && activityCount.count === 0) {
    const adminUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin') || { id: 1 };
    const lawyerUser = db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('lawyer') || { id: 2 };

    const insertActivity = db.prepare(`
      INSERT INTO activity_log (user_id, action, entity_type, entity_id, details_json, created_at)
      VALUES (?, ?, ?, ?, ?, datetime('now', ?))
    `);

    insertActivity.run(adminUser.id, 'LOGIN', 'user', adminUser.id, JSON.stringify({ email: 'admin@lawyer.com', status: 'نجاح تسجيل الدخول' }), '-3 days');
    insertActivity.run(adminUser.id, 'CREATE_CLIENT', 'client', 1, JSON.stringify({ clientId: 1, name: 'شركة الأمل للتجارة' }), '-3 days');
    insertActivity.run(adminUser.id, 'CREATE_CASE', 'case', 1, JSON.stringify({ caseId: 1, title: 'قضية تحصيل مستحقات مالية - شركة الأمل ضد المورد', case_number: 'CASE-2026-001' }), '-2 days');
    insertActivity.run(lawyerUser.id, 'LOGIN', 'user', lawyerUser.id, JSON.stringify({ email: 'lawyer@lawyer.com' }), '-2 days');
    insertActivity.run(adminUser.id, 'CREATE_EVENT', 'event', 1, JSON.stringify({ eventId: 1, title: 'جلسة المرافعة الأولى', date: '2026-08-20' }), '-1 days');
    insertActivity.run(lawyerUser.id, 'UPDATE_TASK', 'task', 1, JSON.stringify({ taskId: 1, title: 'إعداد مذكرة الدعوى وتدقيق المستندات', status: 'in_progress' }), '-6 hours');
    insertActivity.run(adminUser.id, 'LOGIN', 'user', adminUser.id, JSON.stringify({ email: 'admin@lawyer.com' }), '-1 hours');

    console.log('✅ Seeded default activity logs successfully.');
  }
}

// Run if called directly
if (process.argv[1] && process.argv[1].endsWith('seed.js')) {
  seedDatabase();
}
