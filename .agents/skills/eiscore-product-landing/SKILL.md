---
name: eiscore-product-landing
description: Use this skill only when designing, rebuilding, polishing, or performance-optimizing the EISCore product introduction page at /eiscore. This skill is exclusively for the EISCore public product landing page, not for internal admin pages or general UI work.
---

# EISCore Product Landing Page Skill

This skill is used only for the EISCore product introduction page.

Target route:

`/eiscore`

Official access URL:

`http://localhost/eiscore`

Do not use this skill for:

- HR internal pages
- material/inventory internal pages
- App Center internal pages
- mobile internal pages
- admin dashboards
- general UI redesign
- unrelated landing pages

## Purpose

Create and iteratively improve the EISCore product introduction page so that it looks like a polished Chinese B2B SaaS / AI SaaS / manufacturing digitalization product website.

The page must be:

- visually premium
- credible for enterprise and government-facing presentation
- clear enough for non-technical visitors
- technically convincing for developers
- smooth and not janky
- bilingual if requested
- consistent with EISCore licensing and commercial boundary files

## Product Positioning

EISCore is an AI-assisted enterprise informatization core platform for small and medium-sized manufacturing enterprises.

It is not merely a thesis demo. The public landing page should explain that EISCore is a real modular codebase informed by enterprise digitalization implementation and secondary customization experience.

Core positioning:

中文：
EISCore 是面向中小制造企业的 AI+企业信息化底座，围绕人员、物料、库存、流程、数据、移动端现场作业和智能体辅助能力，构建轻量、可扩展、可追溯的企业信息化核心平台。

English:
EISCore is an AI-assisted enterprise informatization core platform for SME manufacturing, connecting people, materials, inventory, workflows, data, mobile field operations, and agent-assisted capabilities into a traceable and extensible enterprise system foundation.

## Mandatory Codebase Scan

Before writing or changing marketing copy, scan the real project codebase. Do not rely only on the thesis.

Inspect:

- README.md
- LICENSE
- NOTICE
- COPYRIGHT.md
- COMMERCIAL-LICENSE.md
- docs/LICENSE-DOCS.md
- docker-compose.yml
- eiscore-base
- eiscore-hr
- eiscore-materials
- eiscore-apps
- eiscore-mobile
- eiscore-sales
- eiscore-purchase
- eiscore-production
- realtime
- sql
- env
- docs/evidence
- docs/thesis

Extract real capabilities:

- base portal
- micro-frontend shell
- HR / HMS
- materials / inventory / WMS-like capabilities
- app center
- workflow / approval center
- ontology / semantic workbench
- mobile workbench
- sales
- purchase
- production
- realtime / agent runtime
- PostgreSQL schema, functions, triggers, RLS, views
- Docker / Nginx / PostgREST / Swagger / code-server if present

Use careful wording:

- 当前代码库已形成多业务子应用结构
- 核心模块已形成可运行原型
- 部分业务域处于扩展实现阶段
- 支持后续按行业项目继续扩展
- 可作为轻量企业信息化底座

Never claim that every module is fully mature or commercially complete unless verified.

## Design Direction

The target look is:

AI SaaS 高级黑金 / 蓝紫风 + 中文 B2B SaaS 官网 + 制造业数字化产品叙事

Use these as structural inspiration:

- Chinese manufacturing digitalization SaaS websites
- Chinese low-code / enterprise application platform websites
- premium AI SaaS websites
- developer infrastructure product websites

But do not copy any brand, logo, layout, text, or asset directly.

The page should feel closer to a real product website than a student project page.

## Visual Style

Preferred:

- dark navy / near-black background
- restrained gold accents
- blue-violet gradient highlights
- high-quality typography hierarchy
- clean section rhythm
- clear business copy
- lightweight SVG diagrams
- product capability cards
- structured module matrix
- credible architecture section
- calm motion

Avoid:

- generic AI template look
- random glowing cards everywhere
- too many particles
- too many floating nodes
- heavy blur
- heavy box-shadow animation
- fast carousel
- decorative animation that does not explain the product
- thesis/report style writing

## Performance Rules

The page must be smooth.

Do not create or keep effects that make the page janky.

Avoid:

- WebGL
- Canvas particle systems
- large continuous SVG line animations
- frequent timers
- large `filter: blur()` areas
- animated `backdrop-filter`
- large animated shadows
- high-frequency auto carousel
- too many infinite animations

Prefer:

- static or low-motion SVG
- CSS transform and opacity
- one-time scroll reveal
- manual carousel or slow carousel
- hover effects only where useful
- `prefers-reduced-motion`
- mobile animation reduction

If a visual effect hurts scrolling performance, remove it.

## Required Page Sections

The `/eiscore` product introduction page should normally contain:

1. Hero
   - product name
   - clear positioning
   - primary CTA
   - lightweight product capability panel

2. Pain Points
   - data fragmentation
   - traceability difficulty
   - manual workflow coordination
   - systems that are either too heavy or not extensible

3. EISCore Solution
   - database-centric architecture
   - micro-frontend modularity
   - workflow-to-state mapping
   - lightweight semantic governance
   - mobile field operations
   - agent-assisted configuration

4. Real Codebase Capabilities
   - describe real modules discovered from the repository
   - indicate mature / prototype / expanding status carefully

5. Manufacturing Scenarios
   - multi-batch materials
   - shelf life / FIFO
   - production picking and supplementary material
   - quality attachments and delayed inspection
   - shipment and logistics information
   - forward/reverse traceability
   - mobile stocktaking and label printing
   - approval and state write-back

6. Platform Capabilities
   - app center
   - data application configuration
   - workflow designer
   - approval center
   - table/form capability
   - semantic relationship workbench
   - controlled agent runtime

7. Technical Architecture
   - Frontend Shell: Vue 3 / Vite / qiankun
   - Data API: PostgREST / RPC / WebSocket
   - Database Core: PostgreSQL / RLS / Schema / Functions / Triggers
   - Intelligence Layer: Semantic Layer / Agent Runtime / Knowledge QA / Tool Calling

8. Practice Experience
   - state that EISCore is informed by implementation and secondary customization experience
   - use industry labels, not customer logo wall
   - include disclaimer

9. Open Source and Commercial Boundary
   - AGPL-3.0-or-later
   - CC BY-NC-SA 4.0 for docs if applicable
   - open source does not transfer copyright
   - commercial closed-source delivery, government product declaration, software copyright registration, product ownership declaration, SaaS/private deployment without AGPL compliance requires separate written authorization

10. Footer
   - EISCore
   - Copyright (c) 2026 林志荣
   - License
   - Documentation
   - Commercial License
   - Thesis Evidence if present

## Practice Experience Boundary

Allowed:

EISCore 的设计来源于作者参与中小制造企业数字化项目实施、二次定制、需求调研与系统交付过程中沉淀的共性问题。

Allowed industry labels:

- 水产加工
- 食品制造
- 罐头加工
- 生物制品
- 农产品加工
- 仓储物流
- 质量追溯
- 移动盘点
- 生产计划
- 通信生态协同

Do not write:

- named companies are EISCore customers
- EISCore has served named customer X
- EISCore has official cooperation with China Mobile, China Unicom, or China Telecom
- customer logo wall without authorization

Required disclaimer if discussing practice experience:

“部分实践经验来源于作者参与的企业数字化实施与二次定制工作，相关表述仅用于说明行业经验来源，不代表相关企业或机构对 EISCore 的商业背书、采购确认或正式授权案例。”

## Bilingual Support

If bilingual support is requested or already present:

- default language: Chinese
- switch: 中文 / EN
- no heavy i18n dependency unless already present
- use local content mapping inside the landing page if possible
- all major sections must switch language
- English should be natural and product-style, not literal machine translation

## Official Access and Route

The official access route is:

`http://localhost/eiscore`

Do not present `localhost:8080` as the official access URL.

If needed, Vite dev port can be used only for local debugging, but final report must use `http://localhost/eiscore`.

If Nginx history fallback needs adjustment, make only minimal changes and do not break:

- `/api`
- `/agent`
- Swagger
- code-server
- other sub-application routes

## Implementation Scope

Primary file:

`eiscore-base/src/views/EiscoreLanding.vue`

Possible route file:

`eiscore-base/src/router/index.js`

Avoid modifying anything else unless necessary.

Do not modify:

- business modules
- API code
- database code
- auth code
- PostgREST config
- Agent Runtime
- Docker services unless route fallback is required

## Visual QA

If Playwright or browser automation is available:

1. Open `http://localhost/eiscore`.
2. Capture desktop screenshot.
3. Capture mobile screenshot.
4. Check scroll smoothness.
5. Check bilingual switching.
6. Check route refresh.
7. Confirm `/api` and `/agent` are not affected.
8. Iterate if the page still looks generic, ugly, or janky.

If browser automation is not available, report that limitation clearly.

## Completion Report

Every task using this skill must report:

- real project files/directories scanned
- files changed
- route status
- design direction used
- sections implemented
- bilingual support status
- performance optimizations
- animations removed or reduced
- whether new dependencies were added
- whether business logic was untouched
- localhost:80 access status
- build/browser check result
- remaining visual or performance risks
- suggested git add / commit commands
