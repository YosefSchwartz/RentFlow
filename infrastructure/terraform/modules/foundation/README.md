# Module: foundation

**Status:** implemented. **Creates no AWS resources.**

The shared **Foundation layer (Layer 2)**. Every environment root calls it once;
every future infrastructure module consumes its outputs. It is the single source
of truth for naming, tagging, and safety validation.

## Responsibilities

- **Centralized naming** — one `name_prefix` (`rentflow-<environment>`) that all
  modules build on. Names are never hardcoded elsewhere.
- **Centralized tags** — one `common_tags` map applied to every resource.
- **Environment validation** — only `staging` / `production` are accepted.
- **Region validation** — only `eu-central-1` is accepted.
- **Account validation** — plan fails if the caller's real AWS account is not the
  one the environment expects.
- **Project metadata** — project/application/owner surfaced as outputs.

## Naming strategy

```
<project-slug>-<environment>-<resource>
        │            │            └─ each module appends its own suffix
        │            └─ staging | production
        └─ lower(var.project) = "rentflow"
```

`name_prefix = "${lower(var.project)}-${var.environment}"` → e.g.
`rentflow-staging`. Downstream modules do:

```hcl
name = "${var.name_prefix}-documents"   # rentflow-staging-documents
```

Examples: `rentflow-staging-api`, `rentflow-staging-db`,
`rentflow-staging-documents`, `rentflow-production-api`.

## Validation strategy

| What | How | When it fails |
| --- | --- | --- |
| Environment ∈ {staging, production} | `variable` validation | variable evaluation (earliest) |
| Region == `eu-central-1` | `variable` validation | variable evaluation |
| Account == expected (`aws_account_id`) | `data.aws_caller_identity` **postcondition** | `tofu plan` (hard error, not a warning) |

The account check compares the *expected* account (passed per environment) with
the account the credentials actually resolve to — catching "right config, wrong
profile" mistakes before anything is created. `check` blocks were **not** used
because they only warn; a data-source `postcondition` fails the plan.

## Inputs

| Name | Default | Notes |
| --- | --- | --- |
| `project` | `RentFlow` | Project tag + naming slug (lower-cased). |
| `application` | `rentflow` | Application tag. |
| `environment` | — (required) | `staging` / `production`. |
| `aws_region` | `eu-central-1` | Must be `eu-central-1`. |
| `aws_account_id` | — (required) | Expected 12-digit account for this env. |
| `owner` | `yosef.sh05@gmail.com` | Owner tag. |
| `additional_tags` | `{}` | Merged on top of the standard tags. |

## Outputs

`name_prefix`, `common_tags`, `project`, `application`, `environment`,
`aws_region`, `account_id`.

## Future module usage

Roots call foundation once and thread its outputs into every other module — so
naming and tagging are defined once and reused everywhere:

```hcl
module "foundation" {
  source         = "../../modules/foundation"
  environment    = var.environment
  aws_region     = var.aws_region
  aws_account_id = var.aws_account_id
}

module "networking" {
  source      = "../../modules/networking"
  name_prefix = module.foundation.name_prefix   # rentflow-staging
  tags        = module.foundation.common_tags
  # ...
}
```

Downstream modules therefore expose `name_prefix` + `tags` inputs and add **no**
naming/tagging logic of their own.
