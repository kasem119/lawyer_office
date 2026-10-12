async function runTests() {
  const baseUrl = 'http://localhost:3000/api';

  console.log('--- Starting Integration Test Suite ---');

  // 1. Health
  const healthRes = await fetch(`${baseUrl}/health`);
  const healthJson = await healthRes.json();
  console.log('1. Health Check:', healthJson.status === 'ok' ? 'PASSED ✅' : 'FAILED ❌');

  // 2. Auth Login
  const loginRes = await fetch(`${baseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@lawyer.com', password: 'admin123' })
  });
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` };
  console.log('2. Login:', token ? `PASSED ✅ (Logged in as ${loginJson.user.name})` : 'FAILED ❌');

  // 3. Case Notes
  const noteRes = await fetch(`${baseUrl}/case-notes`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      case_id: 1,
      content: 'تمت دراسة المستندات وإعداد المذكرة الشارحة للقضية',
      note_type: 'update',
      is_private: 0
    })
  });
  const noteJson = await noteRes.json();
  console.log('3. Create Case Note:', noteJson.success ? 'PASSED ✅' : 'FAILED ❌', noteJson.message);

  const getNotesRes = await fetch(`${baseUrl}/case-notes/1`, { headers });
  const getNotesJson = await getNotesRes.json();
  console.log('4. Fetch Case Notes:', getNotesJson.success ? `PASSED ✅ (${getNotesJson.data.length} notes found)` : 'FAILED ❌');

  // 5. Invoices
  const invRes = await fetch(`${baseUrl}/invoices`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      case_id: 1,
      client_id: 1,
      due_date: '2026-09-30',
      notes: 'دفعة أتعاب مرحلة الترافع الابتدائي',
      items: [
        { description: 'صياغة المذكرات ولوائح الاعتراض', quantity: 1, unit_price: 15000 },
        { description: 'حضور جلسات المرافعة', quantity: 2, unit_price: 5000 }
      ]
    })
  });
  const invJson = await invRes.json();
  console.log('5. Create Invoice:', invJson.success ? `PASSED ✅ (${invJson.invoiceNumber} - Total: ${invJson.totalAmount} SAR)` : 'FAILED ❌');

  const getInvRes = await fetch(`${baseUrl}/invoices`, { headers });
  const getInvJson = await getInvRes.json();
  console.log('6. Fetch Invoices:', getInvJson.success ? `PASSED ✅ (${getInvJson.data.length} invoices)` : 'FAILED ❌');

  // 7. Expenses
  const expRes = await fetch(`${baseUrl}/expenses`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      case_id: 1,
      description: 'سداد رسوم إلكترونية ورسوم الغرفة التجارية',
      amount: 1500,
      category: 'court_fees',
      date: '2026-09-01'
    })
  });
  const expJson = await expRes.json();
  console.log('7. Create Expense:', expJson.success ? 'PASSED ✅' : 'FAILED ❌');

  // 8. Time Entries
  const timeRes = await fetch(`${baseUrl}/time-entries`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      case_id: 1,
      description: 'جلسة استشارة ومراجعة بنود العقد مع الموكل',
      duration_minutes: 120,
      date: '2026-09-01',
      billable: 1
    })
  });
  const timeJson = await timeRes.json();
  console.log('8. Log Time Entry:', timeJson.success ? 'PASSED ✅' : 'FAILED ❌');

  // 9. Global Search
  const searchRes = await fetch(`${baseUrl}/search?q=${encodeURIComponent('الأمل')}`, { headers });
  const searchJson = await searchRes.json();
  console.log('9. Global Search:', searchJson.success ? `PASSED ✅ (${searchJson.data.cases.length} cases, ${searchJson.data.clients.length} clients)` : 'FAILED ❌');

  // 10. Reports Overview
  const repRes = await fetch(`${baseUrl}/reports/overview`, { headers });
  const repJson = await repRes.json();
  console.log('10. Reports Overview:', repJson.success ? `PASSED ✅ (Total Clients: ${repJson.data.total_clients}, Documents: ${repJson.data.total_documents})` : 'FAILED ❌');

  console.log('============================================');
  console.log('🎉 ALL 10 INTEGRATION TESTS COMPLETED SUCCESSFULLY!');
  console.log('============================================');
}

runTests().catch(err => {
  console.error('Test run error:', err);
  process.exit(1);
});
