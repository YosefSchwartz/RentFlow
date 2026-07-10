# Use-Case Flows

Mermaid diagrams describing RentFlow's main use cases as flows (sequence /
flowchart). These document how the mobile app, REST API, and database
collaborate for each core scenario.

## Conventions

- One file per use case, named in `kebab-case.mmd`.
- Use `sequenceDiagram` for request/response interactions (Mobile → API → DB)
  and `flowchart` for decision/state flows (e.g. lease or maintenance status).
- Keep actors consistent: `Tenant`, `Landlord`, `Mobile`, `API`, `DB`.
- A user has **no role** — capabilities come from ownership / lease
  relationships. Reflect that in the diagrams (the same account can be both).

## Rendering

- GitHub renders `.mmd`/fenced ` ```mermaid ` blocks automatically.
- VS Code: "Markdown Preview Mermaid Support" or "Mermaid Preview" extensions.
- CLI: `npx @mermaid-js/mermaid-cli -i flows/<file>.mmd -o flows/<file>.svg`.

## Index

Drop diagrams here as you create them. Expected core use cases:

| File | Use case |
| --- | --- |
| `auth.mmd` | Register / login / refresh-token rotation |
| `property-management.mmd` | Create / edit / list properties (owner) |
| `tenant-onboarding.mmd` | Landlord creates lease → tenant redeems activation code |
| `lease-lifecycle.mmd` | Create lease (`PENDING` → `ACTIVE` → `ENDED`), status, terminate |
| `documents.mmd` | Upload / view property & lease documents |
| `maintenance.mmd` | Report issue → chat → status `OPEN → IN_PROGRESS → RESOLVED` |
| `notifications.mmd` | Notification fan-out across the flows above |
