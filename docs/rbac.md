# CourseWeaver RBAC — Rollenmodell (Stand 29.09.2026)

## Layer-Trennung (wichtigster Grundsatz)
Zentrale Anmeldung = **Authentifizierung** (OIDC/SSO, liefert nur Identität: iss/sub/e-Mail).
Berechtigungsmodell = **Autorisierung** (Rolle innerhalb CourseWeaver) — rein in dieser App verwaltet, **nicht** im Token mitgeliefert. TimeWeaver/das künftige Admin-Tool haben eigene Modelle.

## vereinfachte RBAC-Matrix (geordnete Stufen)

| Stufe | Rolle | view | editOwn | editForeign | release | manageStructure | manageRoles |
|---|---|---|---|---|---|---|---|
| 0 | reader | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| 1 | user | ✅ | ✅* | ❌ | ❌ | ❌ | ❌ |
| 2 | superuser | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| 3 | admin (global) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

\* "own" = object-admin in `entity_acl` ODER `created_by` == eine eigene modul-Zuweisung.

Prüfung im Code via `ROLE_LEVEL.role >= min` (RBAC-Standard). Unter dem dev-Bypass (keine OIDC-Claims, `API_AUTH_TOKEN` leer) bleibt der Bestandsmodus: unauthentifizierte Requests = fallback global admin (für Seed/Regressions-Tests), sobald OIDC-Claims vorliegen greift das RBAC-Modell strikt.

## Vererbung über die Hierarchie
module → degree → program → department — "spezifischster Treffer gewinnt":
`resolveEntityRole(userId, table, entityId)` durchläuft die Elternkette; erste
Übereinstimmung in `entity_roles` gewinnt; sonst `reader`.

## Globale Admin-Rolle
`local_users.is_admin` — Wildcard-Admin, getrennt vom entitätsgebundenen Modell
(deshalb "Rollen vergeben" etc. überall global admin-gated).

## API
- `GET  /api/rbac/roles?entityType=` — alle Zuweisungen (admin)
- `PUT  /api/rbac/roles {userId, entityType, entityId, role:[reader|user|superuser|admin]}` — set (admin)
- `DELETE /api/rbac/roles {userId, entityType, entityId}` — remove (admin)
- `GET  /api/rbac/me?entityType&entityId` — effektive Rolle desUsers

## UI
`/admin` → Card "RBAC Role assignments" (Person · entityType · entityId · Rolle) inkl. Matrix-Hinweis; Repository-Speicherung über `entity_roles` (FK auf local_users).
