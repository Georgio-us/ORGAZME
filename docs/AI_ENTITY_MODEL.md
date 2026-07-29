# ORGAZME AI entity model

The voice interpreter produces reviewable atomic proposals. Nothing is written
to business data until the user selects and saves the proposal.

## Entity boundaries

| Meaning | Proposal | Persistence |
| --- | --- | --- |
| Future action | `task` | `events` |
| Scheduled conversation | `meeting` | `events` |
| Historical business occurrence | `event` | `events` |
| Communication that happened | `contact` | `events` |
| Explicit chronological note | `note` | `events` |
| New client | `client_create` | `clients` |
| Client card state | `client_update.clientPatch` | `clients` columns |
| Durable client memory | `client_update.contextChange` | `clients.context` |
| Money, debt, revenue or opportunity | `client_update.financeChange` | `clients.context.financial` and finance entries |

## Durable client memory

`contextChange.field` identifies the meaning of a fact:

- Profile: `business_type`, `industry`, `country`, `region`, `base_location`.
- Relationship: `relationship_started`, `relationship_quality`,
  `relationship_origin`, `referral_potential`.
- People: `primary_contact`, `stakeholder`.
- Work: `project`, `service`, `blocker`, `priority`, `plan`, `market`,
  `consultation`.
- Personal operating context: `preference`, `communication_style`,
  `decision_pattern`, `insight`, `risk`.
- Fallback: `summary`, `general_fact`.

Durable facts do not become timeline events merely because the user says
“добавь”. For example:

- “Пришла по рекомендации” → `relationship_origin`.
- “Склонна давать рекомендации” → `referral_potential`.
- “Не любит длинные созвоны” → `preference`.
- “Принимает решение после согласования с партнёром” → `decision_pattern`.
- “Может стать источником новых клиентов” → `insight`.
- “Медленно присылает материалы” → `blocker` or `risk`, depending on whether
  it blocks current work or describes a durable relationship risk.

## Financial meanings

- `contract_value`: agreed or completed work value.
- `payment_received`: money explicitly paid or received.
- `receivable`: confirmed outstanding debt.
- `expected_revenue`: agreed expected renewal revenue.
- `opportunity`: unconfirmed upsell potential.
- `recurring_fee`: recurring engagement fee.
- `reimbursement`: expense to be reimbursed.

“Работы выполнены на €700” is contract value. It is not payment received unless
the user explicitly says that the money was paid or received.

## Review and dependency rules

- Every meaning is a separate selectable card.
- Unselected cards are rejected when selected cards are saved.
- Selecting a proposal linked to a new client also selects its
  `client_create` parent.
- Closing the review rejects the whole pending set.
- A `client_update` must contain exactly one of `clientPatch`,
  `contextChange`, or `financeChange`.

