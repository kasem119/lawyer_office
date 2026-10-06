import urllib.request
import json

HOST = "http://102.203.202.104"

def post(url, data, token=None):
    req = urllib.request.Request(
        HOST + url,
        data=json.dumps(data).encode('utf-8'),
        headers={'Content-Type': 'application/json', **({'Authorization': f'Bearer {token}'} if token else {})}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

def get(url, token):
    req = urllib.request.Request(
        HOST + url,
        headers={'Authorization': f'Bearer {token}'}
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read().decode('utf-8'))

print("--- 1. اختبار دخول المحامي (أ. أحمد - مدير المكتب الرئيسي) ---")
status, res = post('/api/auth/login', {'email': 'admin@lawyer.com', 'password': 'Password@123456'})
print(f"Login Status: {status}")
if status == 200:
    lawyer_token = res['accessToken']
    print(f"اسم المستخدم: {res['user']['name']}")
    print(f"الدور (Role): {res['user']['role']}")
    print(f"المكتب (Tenant ID): {res['user']['tenant_id']}")
    
    # Check users list for this lawyer
    st_users, res_users = get('/api/users', lawyer_token)
    print(f"قائمة المحامين في مكتبه (عدد = {len(res_users.get('users', []))}):")
    for u in res_users.get('users', []):
        print(f"   - {u['name']} ({u['email']}) - الدور: {u['role']}")
        
    # Check that lawyer CANNOT access platform admin
    st_plat, res_plat = get('/api/platform/stats', lawyer_token)
    print(f"محاولة دخول المحامي للوحة المالك العام (/api/platform/stats): Status = {st_plat} (يجب أن يكون 403 ممنوع)")
    print(f"رسالة المنع: {res_plat.get('message')}")

print("\n--- 2. اختبار دخول المالك العام (Super Admin) ---")
status2, res2 = post('/api/auth/login', {'email': 'owner@lawyer.ly', 'password': 'Owner#Libya2026!'})
print(f"Owner Login Status: {status2}")
if status2 == 200:
    owner_token = res2['accessToken']
    print(f"اسم المستخدم: {res2['user']['name']}")
    print(f"الدور (Role): {res2['user']['role']}")
    
    st_plat2, res_plat2 = get('/api/platform/stats', owner_token)
    print(f"دخول المالك للوحة المالك العام (/api/platform/stats): Status = {st_plat2}")
    print(f"إحصائيات المنصة: {res_plat2.get('stats')}")
