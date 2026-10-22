# Runbook — Alta de un admin y enrolamiento del primer factor MFA

> T-317. Lo ejecuta Lautaro073 (o quien él designe) una vez por cuenta admin, contra `cadeapp-staging`: el
> proyecto Supabase que comparten `feat/*`, `develop` y `staging`. Producción queda fuera de este runbook.
> Nunca pegues contraseñas, códigos, claves TOTP ni QR en el repo, issues, bitácoras o chats.

## Por qué existe
El rol `admin` no se puede elegir al registrarse: `handle_new_user()` solo acepta `merchant` y `courier`
(master plan §9.3, `docs/tasks/T-004.md` `PR54-H03`). Además, las rutas y RPC `admin_*` exigen MFA TOTP (`aal2`) y
la app **no** tiene pantalla para enrolar el primer factor, a propósito: Supabase permite enrolar el primer factor
con solo la contraseña (`aal1`), así que esa pantalla le daría `aal2` a cualquiera que la tenga.

## 1. Crear la cuenta
Registrate en la app del ambiente (`/register`) como **comercio** o **repartidor**, con el email que va a ser admin.
Confirmá el email si el ambiente lo pide. No hace falta completar el onboarding.

## 2. Promover a admin (SQL, una sola vez)
En el panel de Supabase del ambiente → **SQL Editor**, corré (reemplazá el email):

```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'admin@ejemplo.com')
returning id, role, consent_status;
```

- Tiene que devolver **1 fila** con `role = admin`. Si devuelve 0, el email no existe en ese ambiente.
- El admin queda exento del consentimiento legal (CC-007); `consent_status` puede quedar como esté.
- Solo Lautaro073 promueve cuentas. No se hace desde la app ni con la service role en scripts.

Para comprobarlo después:

```sql
select p.id, p.role from public.profiles p join auth.users u on u.id = p.id where u.email = 'admin@ejemplo.com';
```

## 3. Enrolar el TOTP
En tu terminal, desde la raíz del repo. La herramienta no lee `.env.local`: solo toma de la sesión de la terminal
las dos variables públicas de `cadeapp-staging` (URL del proyecto y anon/publishable key). Ninguna otra variable
hace falta, y la service role no se usa.

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL = "https://<ref-de-cadeapp-staging>.supabase.co"
$env:NEXT_PUBLIC_SUPABASE_ANON_KEY = "<anon key pública de cadeapp-staging>"
pnpm admin:mfa-enroll
```

En bash: `NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… pnpm admin:mfa-enroll`.

La herramienta (`tools/admin-mfa-enroll.mjs`):
1. muestra el host del proyecto Supabase: confirmá que sea `cadeapp-staging` antes de seguir;
2. pide email y contraseña (la contraseña no se ve al tipear; sin una terminal interactiva se niega a pedirla) y
   entra con la anon key, como vos;
3. se niega si la cuenta no es admin o si ya tiene un factor TOTP verificado;
4. borra factores sin verificar de intentos anteriores y crea uno nuevo;
5. guarda el QR en un archivo temporal con permisos restringidos y te muestra **solo la ruta**: abrilo y escanealo
   con la app;
6. pide el código de 6 dígitos de la app (Google Authenticator, 1Password, Authy…), lo verifica y comprueba `aal2`;
7. borra el QR y cierra la sesión local, pase lo que pase.

Si falla el código, volvé a correrla: el factor sin verificar se limpia solo.

## 4. Entrar
`/login` con email y contraseña → `/login/mfa` con el código de la app → `/admin/applicants`.

## 5. Si se pierde el celular
Recuperar o rotar el factor está fuera de T-317. Avisá a Lautaro073: hoy se resuelve borrando el factor desde el panel
de Supabase (**Authentication → Users → el usuario → MFA factors**) y repitiendo el paso 3.
