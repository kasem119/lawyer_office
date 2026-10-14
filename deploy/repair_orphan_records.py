"""Audit foreign-key orphans; changes require a reviewed, fingerprinted plan."""
import json
import shlex
import sys
from datetime import datetime, timezone
from deploy_remaining_fixes import connect, guard, ROOT

AUDIT = r'''
import pathlib,sqlite3,json,hashlib
base=pathlib.Path('/opt/lawyer_office');dbpath=base/'server/database/lawyer_office.db'
for line in (base/'server/.env').read_text().splitlines():
 if line.strip().startswith('DB_PATH='):
  v=line.split('=',1)[1].strip().strip('"\'')
  if v:dbpath=pathlib.Path(v) if v.startswith('/') else base/'server'/v
db=sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True);db.row_factory=sqlite3.Row
q=lambda name:'"'+name.replace('"','""')+'"'
rows=[]
tables=[r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
for error in db.execute('PRAGMA foreign_key_check'):
 table,rowid,parent,fkid=tuple(error)
 fk=next(r for r in db.execute('PRAGMA foreign_key_list('+q(table)+')') if r['id']==fkid)
 row=dict(db.execute('SELECT * FROM '+q(table)+' WHERE rowid=?',(rowid,)).fetchone())
 column=next(r for r in db.execute('PRAGMA table_info('+q(table)+')') if r['name']==fk['from'])
 incoming=0
 for other in tables:
  for child in db.execute('PRAGMA foreign_key_list('+q(other)+')'):
   if child['table']==table:
    target=child['to'] or 'id'
    incoming+=db.execute('SELECT count(*) FROM '+q(other)+' WHERE '+q(child['from'])+'=?',(row[target],)).fetchone()[0]
 tenant=row.get('tenant_id');case=row.get('case_id');document=row.get('document_id')
 case_data=db.execute('SELECT tenant_id FROM cases WHERE id=?',(case,)).fetchone() if case is not None else None
 doc_data=db.execute('SELECT tenant_id FROM documents WHERE id=?',(document,)).fetchone() if document is not None else None
 rows.append({'table':table,'rowid':rowid,'missing_parent':parent,'column':fk['from'],'missing_id':row[fk['from']],
  'nullable':not bool(column['notnull']),'tenant_id':tenant,'tenant_exists':bool(db.execute('SELECT 1 FROM tenants WHERE id=?',(tenant,)).fetchone()) if tenant is not None else None,
  'case_exists':bool(case_data) if case is not None else None,'case_tenant':case_data['tenant_id'] if case_data else None,
  'document_exists':bool(doc_data) if document is not None else None,'document_tenant':doc_data['tenant_id'] if doc_data else None,
  'incoming_references':incoming,'fingerprint':hashlib.sha256(json.dumps(row,sort_keys=True,ensure_ascii=False).encode()).hexdigest()})
print(json.dumps({'integrity':db.execute('PRAGMA integrity_check').fetchone()[0],'violations':rows},ensure_ascii=False));db.close()
'''

APPLY = r'''
import pathlib,sqlite3,json,hashlib,os,subprocess,sys,time,urllib.request
c=json.loads(sys.stdin.read());plan=c['plan'];base=pathlib.Path('/opt/lawyer_office');dbpath=base/'server/database/lawyer_office.db'
assert len(plan)==7 and len({(r['table'],r['rowid']) for r in plan})==7
for line in (base/'server/.env').read_text().splitlines():
 if line.strip().startswith('DB_PATH='):
  v=line.split('=',1)[1].strip().strip('"\'')
  if v:dbpath=pathlib.Path(v) if v.startswith('/') else base/'server'/v
q=lambda name:'"'+name.replace('"','""')+'"'
def fingerprint(row):return hashlib.sha256(json.dumps(dict(row),sort_keys=True,ensure_ascii=False).encode()).hexdigest()
def repair(db):
 db.row_factory=sqlite3.Row;db.execute('PRAGMA foreign_keys=ON')
 errors=[dict(r) for r in db.execute('PRAGMA foreign_key_check')]
 assert {(r['table'],r['rowid']) for r in errors}=={(r['table'],r['rowid']) for r in plan},'Orphan set changed since audit'
 tables=[r['name'] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]
 changed={'expenses','subscriptions','time_entries','document_versions'}
 stable={t:hashlib.sha256(json.dumps([dict(r) for r in db.execute('SELECT * FROM '+q(t)+' ORDER BY rowid')],sort_keys=True,ensure_ascii=False).encode()).hexdigest() for t in tables if t not in changed}
 expenses_before=[dict(r) for r in db.execute('SELECT * FROM expenses ORDER BY rowid')]
 db.execute('BEGIN IMMEDIATE');deleted={};updated={}
 try:
  for item in plan:
   table=item['table'];row=db.execute('SELECT * FROM '+q(table)+' WHERE rowid=?',(item['rowid'],)).fetchone()
   assert row is not None and fingerprint(row)==item['fingerprint'],'Target record changed since audit'
   assert item['incoming_references']==0
   for other in tables:
    for fk in db.execute('PRAGMA foreign_key_list('+q(other)+')'):
     if fk['table']==table:
      assert db.execute('SELECT count(*) FROM '+q(other)+' WHERE '+q(fk['from'])+'=?',(row[fk['to'] or 'id'],)).fetchone()[0]==0,'New dependent record exists'
   fk=next(r for r in db.execute('PRAGMA foreign_key_list('+q(table)+')') if r['from']==item['column'] and r['table']==item['missing_parent'])
   assert db.execute('SELECT 1 FROM '+q(fk['table'])+' WHERE '+q(fk['to'] or 'id')+'=?',(row[fk['from']],)).fetchone() is None,'Parent exists now'
   if table=='expenses':
    assert item['column']=='case_id' and item['nullable'] and item['tenant_exists']
    assert db.execute('SELECT 1 FROM tenants WHERE id=?',(row['tenant_id'],)).fetchone()
    db.execute('UPDATE expenses SET case_id=NULL WHERE rowid=?',(item['rowid'],));updated[table]=updated.get(table,0)+1
   else:
    assert (table,item['missing_parent']) in [('subscriptions','tenants'),('time_entries','cases'),('document_versions','documents')]
    db.execute('DELETE FROM '+q(table)+' WHERE rowid=?',(item['rowid'],));deleted[table]=deleted.get(table,0)+1
  assert not db.execute('PRAGMA foreign_key_check').fetchall(),'Remaining FK violations'
  assert db.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
  for table,digest in stable.items():
   assert hashlib.sha256(json.dumps([dict(r) for r in db.execute('SELECT * FROM '+q(table)+' ORDER BY rowid')],sort_keys=True,ensure_ascii=False).encode()).hexdigest()==digest,'Unrelated table changed'
  expected_expenses=[{**r,'case_id':None} if r['id'] in [p['rowid'] for p in plan if p['table']=='expenses'] else r for r in expenses_before]
  assert [dict(r) for r in db.execute('SELECT * FROM expenses ORDER BY rowid')]==expected_expenses,'Expense contents changed'
  db.commit();return {'deleted':deleted,'updated':updated,'remaining_foreign_key_violations':0,'integrity':'ok','expense_amounts_preserved':True,'unrelated_tables_unchanged':True}
 except Exception:db.rollback();raise
os.umask(0o077)
stopped=False;db=None
try:
 subprocess.run(['systemctl','stop','lawyer-office'],check=True);stopped=True
 backup=base/'deployment-backups'/('orphan-repair-'+c['stamp']);backup.mkdir(mode=0o700)
 with sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True) as source:
  with sqlite3.connect(backup/'office-before.db') as saved:source.backup(saved)
  # Prove the exact plan against a private in-memory production copy first.
  trial=sqlite3.connect(':memory:');source.backup(trial)
 try:repair(trial)
 finally:trial.close()
 db=sqlite3.connect(dbpath);result=repair(db);db.close();db=None
 result.update({'backup':str(backup/'office-before.db'),'dry_run':'passed','uploads_untouched':True})
 (backup/'result.json').write_text(json.dumps(result,indent=2))
finally:
 if db is not None:db.close()
 if stopped:subprocess.run(['systemctl','start','lawyer-office'],check=True)
for i in range(30):
 try:
  with urllib.request.urlopen('http://127.0.0.1:3000/api/health',timeout=3) as r:assert json.load(r)['status']=='ok'
  result['service']='active';result['health']='ok';break
 except Exception:time.sleep(1)
else:raise RuntimeError('Service health check timed out; backup preserved')
# Check after app startup too, ensuring initialization did not recreate old rows.
with sqlite3.connect('file:'+str(dbpath)+'?mode=ro',uri=True) as current:
 assert not current.execute('PRAGMA foreign_key_check').fetchall()
 assert current.execute('PRAGMA integrity_check').fetchone()[0]=='ok'
print(json.dumps(result))
'''

def main():
    out=ROOT/'artifacts/orphan-repair';out.mkdir(parents=True,exist_ok=True)
    ssh=connect()
    try:
        if '--apply' in sys.argv:
            plan=json.loads((out/'AUDIT.json').read_text(encoding='utf-8'))['violations']
            payload={'plan':plan,'stamp':datetime.now(timezone.utc).strftime('%Y%m%d-%H%M%S')}
            result=json.loads(guard.command(ssh,'python3 -u -c '+shlex.quote(APPLY),json.dumps(payload),timeout=120))
            (out/'RESULT.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        else:
            result=json.loads(guard.command(ssh,'python3 -',AUDIT))
            (out/'AUDIT.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
        print(json.dumps(result))
    finally:ssh.close()

if __name__=='__main__':main()
