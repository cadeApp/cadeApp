import sys, re, subprocess
mig = open('supabase/migrations/20260924013700_rpc_admin_v1.sql').read()
test = open(sys.argv[1]).read()
assert test.startswith('begin;')
body = test[len('begin;'):]
funcs = re.split(r'(?=^-- \d\. admin_)', mig, flags=re.M)
def fn(name):
    for f in funcs:
        if f.startswith('-- ') and ('public.'+name+'(') in f:
            return f.split('\n-- H07')[0]
    raise SystemExit('no func '+name)
M = {
 'M0-base': None,
 'C1-CONTROL-sin-aal2-en-decide': ('admin_decide_courier', "if v_aal <> 'aal2' then", "if false then"),
 'C2-CONTROL-decide-sin-audit': ('admin_decide_courier', "insert into public.audit_log", "perform 1; --"),
 'C3-CONTROL-suspend-no-retira': ('admin_suspend_courier', "and status = 'pending';", "and false;"),
 'M1-D03-vuelve-a-solo-suspended': ('admin_decide_courier', "if v_courier_status <> 'pending' then", "if v_courier_status = 'suspended' then"),
 'M2-D04-sin-chequeo-purged': ('admin_verify_document', "if v_doc_status <> 'submitted' or v_purged_at is not null then", "if v_doc_status <> 'submitted' then"),
 'M3-sin-audit-en-suspend': ('admin_suspend_courier', "insert into public.audit_log", "perform 1; --"),
 'M4-sin-audit-en-verify': ('admin_verify_document', "insert into public.audit_log", "perform 1; --"),
 'M5-sin-audit-en-set_subscription': ('admin_set_subscription', "insert into public.audit_log", "perform 1; --"),
 'M6-sin-audit-en-update_setting': ('admin_update_setting', "insert into public.audit_log", "perform 1; --"),
 'M7-sin-aal2-en-suspend': ('admin_suspend_courier', "if v_aal <> 'aal2' then", "if false then"),
 'M8-sin-aal2-en-set_subscription': ('admin_set_subscription', "if v_aal <> 'aal2' then", "if false then"),
 'M9-motivo-no-se-guarda-en-decide': ('admin_decide_courier', "'reason', p_reason)", "'reason', null)"),
}
for k, m in M.items():
    pre = ''
    if m:
        name, a, b = m
        f = fn(name)
        assert a in f, (k, a)
        f2 = f.replace(a, b, 1)
        if b.startswith('perform 1; --'):
            # comment out whole insert statement: replace 'insert into public.audit_log' ... up to ');' of that stmt
            i = f.index('insert into public.audit_log'); j = f.index(');', i) + 2
            f2 = f[:i] + 'perform 1;' + f[j:]
        pre = f2
    sql = 'begin;\n' + pre + '\n' + body
    open('/tmp/m.sql','w').write(sql)
    subprocess.run(['docker','cp','/tmp/m.sql','supabase_db_cadeapp-staging:/tmp/m.sql'], check=True)
    out = subprocess.run(['docker','exec','supabase_db_cadeapp-staging','psql','-U','postgres','-d','postgres','-f','/tmp/m.sql'], capture_output=True, text=True).stdout
    nok = re.findall(r'not ok (\d+)', out); ok = re.findall(r'(?<!not )\bok (\d+)', out)
    print(f"{k}: ok={len(ok)} not_ok={len(nok)} fallan={nok}")
