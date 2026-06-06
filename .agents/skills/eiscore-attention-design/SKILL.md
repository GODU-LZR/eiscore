---
name: eiscore-attention-design
description: Use this skill when productizing EISCore frontend pages, dashboards, tables, forms, workflow screens, mobile/PDA pages, AI assistant panels, or low-code application pages by introducing an attention-design mechanism based on task priority, visual hierarchy, salience, progressive disclosure, and role/context-aware UI focus. Do not use for backend-only refactors unless backend data is needed to drive frontend attention states.
---

# EISCore Attention Design Mechanism Skill

## Core Interpretation

Treat "注意力设计机制", "前端注意力机制", "attention design", "页面聚焦", "产品化重构", "SaaS化界面优化", "信息层级优化", and "驾驶舱/表格/流程页重点突出" as productized frontend attention design, not a neural-network module.

Map the mechanism as:

- Query: user role, task intent, page context, device type, and business scenario.
- Key: visible UI elements such as cards, table rows, columns, alerts, workflow nodes, actions, assistant suggestions.
- Value: business information or action each element provides.
- Attention weight: priority score deciding what is emphasized, deferred, collapsed, or hidden.
- Output: UI state that guides the user toward the highest-value information and next action.

Goal: within 3 seconds, users should know where to look first, what matters now, what is abnormal, and what to do next.

## EISCore Context

Preserve EISCore's structure:

- Vue 3 + Vite, qiankun micro-frontends.
- Element Plus for desktop management UI.
- AG Grid for complex tables.
- ECharts for dashboards.
- Vant for mobile/PDA.
- PostgreSQL + PostgREST + RLS for database-centered API and permissions.
- Modules: base portal, HR, materials/inventory, app center, workflow, sales, purchase, production, quality, equipment, mobile/PDA, AI/agent assistant.

Prefer incremental productization over full rewrites.

## Workflow

### 1. Identify The Page Task

Before editing, infer or document:

- Target module.
- User role.
- Page goal: monitor, input, approve, search, trace, configure, analyze, execute.
- Device: desktop, mobile, PDA, dashboard.
- Critical business risks: overdue, stockout, wrong material, expired batch, pending approval, permission leakage, failed sync, abnormal production, missing attachment.

If role or page goal cannot be inferred, choose a reasonable default and state it in the final summary.

### 2. Build An Attention Map

Classify major UI elements:

- L0 Hidden/secondary: rare or advanced information; move behind more, drawer, tab, tooltip, or detail page.
- L1 Normal: useful but not urgent; keep visible without strong styling.
- L2 Emphasis: important for current task; use order, weight, icon, tag, fixed column, or quick action.
- L3 Warning: needs attention soon; use warning tag, row/cell marker, top summary, badge, default filter.
- L4 Critical: blocks business or creates high risk; use top alert, primary position, clear CTA, reason, and next action.

Never make everything high priority. Usually use one primary focus area, 2-3 secondary focus areas, and keep the rest quiet.

### 3. Define A Priority Model

Prefer a deterministic priority function over ad-hoc styling when attention state depends on data:

```ts
export type AttentionLevel = 'silent' | 'normal' | 'focus' | 'warning' | 'critical'

export interface AttentionContext {
  role?: string
  page?: string
  device?: 'desktop' | 'mobile' | 'pda' | 'dashboard'
  task?: 'monitor' | 'input' | 'approve' | 'search' | 'trace' | 'configure' | 'analyze' | 'execute'
}

export interface AttentionItem {
  id: string
  title: string
  type: 'card' | 'table-row' | 'table-cell' | 'action' | 'workflow-node' | 'alert' | 'metric'
  status?: string
  urgency?: number
  businessImpact?: number
  risk?: number
  frequency?: number
  permissionSensitive?: boolean
  updatedAt?: string
}

export function calcAttentionScore(item: AttentionItem, context: AttentionContext): number {
  const urgency = item.urgency ?? 0
  const impact = item.businessImpact ?? 0
  const risk = item.risk ?? 0
  const frequency = item.frequency ?? 0
  const permissionPenalty = item.permissionSensitive && context.role !== 'admin' ? -15 : 0

  return Math.max(0, Math.min(100,
    urgency * 0.35 + impact * 0.30 + risk * 0.25 + frequency * 0.10 + permissionPenalty
  ))
}

export function scoreToAttentionLevel(score: number): AttentionLevel {
  if (score >= 85) return 'critical'
  if (score >= 65) return 'warning'
  if (score >= 45) return 'focus'
  if (score >= 20) return 'normal'
  return 'silent'
}
```

Adjust weights only when the business page clearly needs different priorities. Keep scoring explainable.

### 4. Map Levels To UI Treatment

- silent: collapse, secondary tab, light text, more menu, detail drawer.
- normal: normal card/table/form display.
- focus: larger card, pinned table column, bold label, icon, status tag, default sort, quick action.
- warning: yellow/orange tag, row/cell marker, top pending area, badge count, default filter.
- critical: red danger tag, top alert, blocking panel, primary CTA, explicit reason, next-action button.

Avoid noisy UI:

- Do not use blinking unless explicitly requested for industrial warning screens.
- Do not use more than one primary button in the same decision area.
- Do not mark more than 20% of visible table rows as high attention unless filtered to exceptions.
- Do not use red for normal emphasis.
- Do not hide information required for audit, approval, or traceability.

## Page-Specific Rules

### Dashboard / Homepage

First screen should answer:

- What needs attention now?
- Which business chain is blocked?
- What should the user do next?
- Which module can solve it?

Use zones: Now, Today, Risk, Next.

### Tables / AG Grid

- Pin identity and business-critical columns: order number, material code, batch number, status, quantity, deadline, owner.
- Add status tags for workflow, stock, quality, sync.
- Sort monitoring pages by abnormality, due time, or latest update.
- Add quick filters: only abnormal, pending, expiring, stockout.
- Use `rowClassRules` or `cellClassRules` for attention levels.
- Never bypass RLS or frontend permission rules.

Example targets:

- Inventory: batch, location, available quantity, expiry, warning state, latest movement.
- Sales: delivery date, stock satisfaction, payment state, customer level.
- Purchase: arrival state, overdue days, quality state, supplier risk.
- Production: progress, shortage, abnormal reporting, quality blocker.

### Forms / Documents

- Group fields by task sequence, not database order.
- Put required and high-risk fields before optional fields.
- Keep the primary action at the end of the main task path.
- Use inline validation for critical fields.
- Hide advanced fields, audit logs, raw JSON, historical versions, and rare settings behind progressive disclosure.
- If data is derived from another module, show source and freshness when trust matters.

Recommended groups: identity, current task input, risk/validation, optional extension, audit.

### Workflow / Approval

- Highlight current node, current handler, next handler, deadline, and blocker.
- Separate "can act now" from "history only".
- Show action buttons only when current user can operate.
- Use compact history timeline plus clear current task card.
- Show mapping when workflow changes business state: workflow node -> business status.

### Mobile / PDA

- Design for one-handed, fast, noisy operation.
- Use large touch targets and short labels.
- Prioritize scan, confirm, quantity, location, exception handling.
- Hide desktop-only management and advanced analysis.
- Use "task card + scan action + result feedback".
- Make offline/poor-network states obvious.

### AI Assistant / Agent Panel

- Do not let chat occupy main business attention unless the task is explicitly AI-driven.
- Show AI suggestions as secondary cards beside the business task.
- Highlight suggestions only when evidence and executable next steps are clear.
- For generated pages, formulas, SQL, or workflows, show preview, diff, risk, and rollback.
- Never auto-apply risky generated changes.

## Implementation Strategy

Inspect the target page and related components before editing.

Prefer reusable utilities when attention logic will repeat:

- Shared/common: `shared/attention/`, `shared/ui/`, or existing shared utility folders.
- Base app: `eiscore-base/src/attention/`.
- HR: `eiscore-hr/src/attention/`.
- Materials: `eiscore-materials/src/attention/`.
- Apps center: `eiscore-apps/src/attention/`.
- Module-local changes: keep near the target view/component.

Suggested files only when reuse is likely:

- `attentionTypes.ts`
- `attentionRules.ts`
- `useAttention.ts`
- `AttentionBadge.vue`
- `AttentionCard.vue`
- scoped attention styles

Do not add a new UI framework. Use Element Plus, AG Grid, ECharts, or Vant already present.

## Visual And Safety Rules

- Use restrained SaaS styling: clear grid, generous spacing, fewer competing panels.
- Use semantic color, not decoration-only color.
- Do not rely on color alone; pair with text, icon, shape, or position.
- Keep keyboard focus visible.
- Make primary actions unambiguous.
- Do not expose permission-sensitive information through badges, tooltips, search, export, or hidden DOM.
- Keep mobile touch targets large enough.

## Acceptance Checklist

A change satisfies this skill only if:

- The page has a clear primary focus.
- Important abnormal states are visible without manual searching.
- Secondary details stay accessible but do not compete.
- Same status uses consistent visual treatment.
- Tables/forms/workflows use business priority, not decoration, for emphasis.
- Permission and audit requirements are preserved.
- Implementation remains compatible with Vue 3, Vite, qiankun, Element Plus/AG Grid/Vant, and the existing module structure.

## Final Response Format

When this skill is used for an implementation, summarize with:

- Target page/module:
- Attention design goal:
- Implemented attention mechanism:
- Main changed files:
- How to verify:
- Remaining risk or follow-up:
