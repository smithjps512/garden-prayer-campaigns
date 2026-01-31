  
**CAMPAIGN ENGINE**

Marketing Automation System

Technical Architecture Document

Version 1.0 | January 2026

*For: Melissa for Educators, Vaquero Homes*

# **1\. System Overview**

## **1.1 Purpose**

Campaign Engine is a closed-loop marketing automation system that generates content from strategic playbooks, distributes across social platforms, tracks performance, and autonomously optimizes based on results. The system operates with minimal human intervention after campaign approval.

## **1.2 Core Principles**

* **Playbook-driven:** All content derives from approved strategic playbooks  
* **Campaign-based approval:** Approve strategy, not individual posts  
* **Autonomous operation:** AI decides when to adjust, scale, or escalate  
* **Data-driven decisions:** Performance metrics drive all optimization  
* **Human escalation:** System escalates only when hitting strategic walls

## **1.3 Supported Businesses**

Initial deployment supports two businesses with the ability to add more: Melissa for Educators (education SaaS, $99/year subscription) and Vaquero Homes (construction/real estate, Texas market). Each business maintains separate playbooks, campaigns, content libraries, and performance tracking.

# **2\. Technology Stack**

## **2.1 Recommended Stack**

| Layer | Technology | Rationale |
| :---- | :---- | :---- |
| Framework | Next.js 14+ (App Router) | Full-stack React, API routes, server components |
| Database | PostgreSQL | Robust, scalable, good JSON support |
| ORM | Prisma | Type-safe, great migrations, intuitive API |
| AI Integration | Anthropic Claude API | Content generation, analysis, recommendations |
| Job Queue | BullMQ \+ Redis | Scheduled posts, background processing |
| Storage | AWS S3 or Cloudflare R2 | Image library storage |
| Hosting | Vercel or Railway | Easy deployment, good Next.js support |
| Auth | Simple password or NextAuth | Single user initially, expandable |

## **2.2 External Integrations**

* **Meta Business API:** Facebook and Instagram posting, ad management, analytics  
* **Meta Pixel:** Conversion tracking on client sites  
* **Anthropic API:** Content generation, performance analysis, recommendations

# **3\. Database Schema**

## **3.1 Entity Relationship Overview**

The schema follows a hierarchical structure: Business → Playbook → Campaign → Content → Post → Performance.

## **3.2 Core Tables**

### **businesses**

id              UUID PRIMARY KEYname            VARCHAR(255) NOT NULL        \-- "Melissa for Educators"slug            VARCHAR(100) UNIQUE          \-- "melissa"description     TEXTwebsite\_url     VARCHAR(500)brand\_colors    JSONB                        \-- {primary: "\#6A1A19", accent: "\#F7AC13"}meta\_page\_id    VARCHAR(100)                 \-- Facebook Page IDmeta\_ig\_id      VARCHAR(100)                 \-- Instagram Account IDmeta\_ad\_account VARCHAR(100)                 \-- Ad Account IDpixel\_id        VARCHAR(100)                 \-- Meta Pixel IDsettings        JSONB                        \-- Business-specific configcreated\_at      TIMESTAMP DEFAULT NOW()updated\_at      TIMESTAMP

### **playbooks**

id              UUID PRIMARY KEYbusiness\_id     UUID REFERENCES businesses(id)name            VARCHAR(255)                 \-- "Q1 2026 Launch Playbook"version         INTEGER DEFAULT 1status          ENUM('draft','active','archived')positioning     TEXT                         \-- Core positioning statementfounder\_story   TEXT                         \-- Founder narrativeaudiences       JSONB                        \-- Array of audience segmentskey\_messages    JSONB                        \-- Messages by segmentobjection\_handlers JSONB                     \-- Objection → Response pairshooks           JSONB                        \-- Array of hooks to testvisual\_direction JSONB                       \-- Brand guidelines, image stylecontent         JSONB                        \-- Full playbook contentcreated\_at      TIMESTAMP DEFAULT NOW()updated\_at      TIMESTAMP

### **campaigns**

id              UUID PRIMARY KEYplaybook\_id     UUID REFERENCES playbooks(id)name            VARCHAR(255)                 \-- "TIA Seekers \- ROI Campaign"status          ENUM('draft','review','approved','setup','live',                     'paused','completed','failed')target\_audience VARCHAR(100)                 \-- Audience segment from playbooktarget\_markets  JSONB                        \-- Geographic targetschannels        JSONB                        \-- \["facebook", "instagram"\]budget\_daily    DECIMAL(10,2)budget\_total    DECIMAL(10,2)start\_date      DATEend\_date        DATE                         \-- NULL \= runs until stoppedsuccess\_metrics JSONB                        \-- {subscribers: 15, cac: 100}performance\_thresholds JSONB                 \-- {exceeding: {...}, meeting: {...}, below: {...}}auto\_optimize   BOOLEAN DEFAULT TRUEhuman\_tasks     JSONB                        \-- Tasks assigned to humanai\_tasks        JSONB                        \-- Tasks for systemapproved\_at     TIMESTAMPapproved\_by     VARCHAR(255)created\_at      TIMESTAMP DEFAULT NOW()updated\_at      TIMESTAMP

### **images**

id              UUID PRIMARY KEYbusiness\_id     UUID REFERENCES businesses(id)filename        VARCHAR(255)storage\_url     VARCHAR(500)                 \-- S3/R2 URLthumbnail\_url   VARCHAR(500)type            ENUM('product','generic','video\_thumbnail')category        VARCHAR(100)                 \-- "feature\_screenshot", "happy\_teacher"tags            JSONB                        \-- For matching  \-- segments: \["tia\_seeker", "true\_believer"\]  \-- emotions: \["achievement", "relief", "connection"\]  \-- themes: \["roi", "feature", "story", "comparison"\]alt\_text        VARCHAR(500)width           INTEGERheight          INTEGERfile\_size       INTEGERmime\_type       VARCHAR(100)usage\_count     INTEGER DEFAULT 0created\_at      TIMESTAMP DEFAULT NOW()

### **image\_requests**

id              UUID PRIMARY KEYbusiness\_id     UUID REFERENCES businesses(id)campaign\_id     UUID REFERENCES campaigns(id)status          ENUM('pending','in\_progress','completed','cancelled')description     TEXT                         \-- What image is neededsuggested\_prompt TEXT                        \-- AI-generated prompt for Midjourneysuggested\_tags  JSONB                        \-- Tags for when createdpriority        INTEGER DEFAULT 5            \-- 1-10fulfilled\_by    UUID REFERENCES images(id)   \-- Links to created imagerequested\_at    TIMESTAMP DEFAULT NOW()completed\_at    TIMESTAMP

### **content**

id              UUID PRIMARY KEYcampaign\_id     UUID REFERENCES campaigns(id)type            ENUM('ad','organic\_post','story')status          ENUM('generated','approved','scheduled','posted',                     'paused','retired')headline        VARCHAR(255)body            TEXTcta\_text        VARCHAR(100)                 \-- "Start Free Trial"cta\_url         VARCHAR(500)utm\_params      JSONB                        \-- {source, medium, campaign, content}image\_id        UUID REFERENCES images(id)platform\_variants JSONB                      \-- Platform-specific versions  \-- {facebook: {text: "...", specs: {...}},  \--  instagram: {text: "...", specs: {...}}}hook\_source     VARCHAR(255)                 \-- Which hook from playbookaudience\_segment VARCHAR(100)generation\_metadata JSONB                    \-- AI generation detailsperformance\_score DECIMAL(5,2)               \-- Calculated scorecreated\_at      TIMESTAMP DEFAULT NOW()updated\_at      TIMESTAMP

### **posts**

id              UUID PRIMARY KEYcontent\_id      UUID REFERENCES content(id)platform        ENUM('facebook','instagram','twitter')platform\_post\_id VARCHAR(255)                \-- External ID from platformstatus          ENUM('scheduled','posted','failed','deleted')scheduled\_for   TIMESTAMPposted\_at       TIMESTAMPerror\_message   TEXTad\_set\_id       VARCHAR(255)                 \-- If paid adtargeting       JSONB                        \-- Ad targeting paramsbudget\_spent    DECIMAL(10,2) DEFAULT 0created\_at      TIMESTAMP DEFAULT NOW()

### **performance**

id              UUID PRIMARY KEYpost\_id         UUID REFERENCES posts(id)recorded\_at     TIMESTAMP DEFAULT NOW()-- Engagement metricsimpressions     INTEGER DEFAULT 0reach           INTEGER DEFAULT 0clicks          INTEGER DEFAULT 0likes           INTEGER DEFAULT 0comments        INTEGER DEFAULT 0shares          INTEGER DEFAULT 0saves           INTEGER DEFAULT 0-- Calculated ratesctr             DECIMAL(5,4)                 \-- Click-through rateengagement\_rate DECIMAL(5,4)-- Conversion metricslanding\_views   INTEGER DEFAULT 0signups         INTEGER DEFAULT 0trials          INTEGER DEFAULT 0purchases       INTEGER DEFAULT 0revenue         DECIMAL(10,2) DEFAULT 0-- Cost metrics (paid only)spend           DECIMAL(10,2) DEFAULT 0cpc             DECIMAL(10,2)                \-- Cost per clickcpa             DECIMAL(10,2)                \-- Cost per acquisitionroas            DECIMAL(10,2)                \-- Return on ad spend

### **conversions**

id              UUID PRIMARY KEYbusiness\_id     UUID REFERENCES businesses(id)post\_id         UUID REFERENCES posts(id)    \-- Attributioncontent\_id      UUID REFERENCES content(id)  \-- Attributioncampaign\_id     UUID REFERENCES campaigns(id)type            ENUM('click','signup','trial','purchase')value           DECIMAL(10,2)                \-- Revenue if purchaseutm\_source      VARCHAR(100)utm\_medium      VARCHAR(100)utm\_campaign    VARCHAR(100)utm\_content     VARCHAR(100)session\_id      VARCHAR(255)user\_agent      TEXTip\_address      VARCHAR(45)geo\_market      VARCHAR(100)                 \-- Matched to target marketcreated\_at      TIMESTAMP DEFAULT NOW()

### **tasks**

id              UUID PRIMARY KEYcampaign\_id     UUID REFERENCES campaigns(id)assignee        ENUM('human','system')type            VARCHAR(100)                 \-- "create\_image", "setup\_meta", etc.title           VARCHAR(255)description     TEXTinstructions    TEXT                         \-- Detailed stepsstatus          ENUM('pending','in\_progress','completed','blocked')priority        INTEGER DEFAULT 5depends\_on      UUID REFERENCES tasks(id)    \-- Task dependencydue\_date        DATEcompleted\_at    TIMESTAMPcompletion\_notes TEXTcreated\_at      TIMESTAMP DEFAULT NOW()

### **escalations**

id              UUID PRIMARY KEYcampaign\_id     UUID REFERENCES campaigns(id)type            ENUM('below\_threshold','persistent\_failure',                     'budget\_depleted','anomaly\_detected',                     'strategic\_question')severity        ENUM('info','warning','critical')title           VARCHAR(255)description     TEXTai\_analysis     TEXT                         \-- AI's assessmentai\_recommendation TEXT                       \-- What AI suggestsdata\_snapshot   JSONB                        \-- Relevant metricsstatus          ENUM('open','acknowledged','resolved','dismissed')human\_response  TEXTresolved\_at     TIMESTAMPcreated\_at      TIMESTAMP DEFAULT NOW()

### **activity\_log**

id              UUID PRIMARY KEYbusiness\_id     UUID REFERENCES businesses(id)campaign\_id     UUID REFERENCES campaigns(id)actor           ENUM('human','system')action          VARCHAR(100)                 \-- "campaign\_approved", "content\_generated"entity\_type     VARCHAR(100)                 \-- "campaign", "content", "post"entity\_id       UUIDdetails         JSONBcreated\_at      TIMESTAMP DEFAULT NOW()

# **4\. API Structure**

## **4.1 API Routes Overview**

RESTful API with Next.js App Router. All routes prefixed with /api/.

### **Businesses**

GET    /api/businesses              List all businessesGET    /api/businesses/:id          Get business detailsPOST   /api/businesses              Create businessPUT    /api/businesses/:id          Update businessDELETE /api/businesses/:id          Delete businessPOST   /api/businesses/:id/connect-meta   Connect Meta accounts

### **Playbooks**

GET    /api/playbooks                    List playbooksGET    /api/playbooks/:id                 Get playbookPOST   /api/playbooks                     Create playbookPUT    /api/playbooks/:id                 Update playbookPOST   /api/playbooks/:id/activate        Set as activePOST   /api/playbooks/generate            AI generates from brief

### **Campaigns**

GET    /api/campaigns                    List campaignsGET    /api/campaigns/:id                 Get campaign with statsPOST   /api/campaigns                     Create from playbookPUT    /api/campaigns/:id                 Update campaignPOST   /api/campaigns/:id/approve         Approve and arm campaignPOST   /api/campaigns/:id/launch          Start campaign (after setup)POST   /api/campaigns/:id/pause           Pause campaignPOST   /api/campaigns/:id/resume          Resume campaignPOST   /api/campaigns/:id/complete        Mark complete

### **Content**

GET    /api/content                      List contentGET    /api/content/:id                   Get content detailsPOST   /api/content/generate              Generate batch for campaignPUT    /api/content/:id                   Edit contentPOST   /api/content/:id/approve           Approve single piecePOST   /api/content/:id/retire            Stop using contentGET    /api/content/:id/performance       Get performance data

### **Images**

GET    /api/images                       List image libraryGET    /api/images/:id                    Get image detailsPOST   /api/images/upload                 Upload new imagePUT    /api/images/:id                    Update tags/metadataDELETE /api/images/:id                    Delete imageGET    /api/images/requests               List pending image requestsPOST   /api/images/requests/:id/fulfill   Link request to uploaded image

### **Tasks**

GET    /api/tasks                        List tasks (filter by assignee)GET    /api/tasks/:id                     Get task detailsPUT    /api/tasks/:id                     Update taskPOST   /api/tasks/:id/complete            Mark completePOST   /api/tasks/:id/block               Mark blocked with reason

### **Analytics**

GET    /api/analytics/dashboard          Overall dashboard statsGET    /api/analytics/campaign/:id        Campaign performanceGET    /api/analytics/content/:id         Content performanceGET    /api/analytics/trends              Performance trends over timeGET    /api/analytics/top-performers      Best performing contentGET    /api/analytics/recommendations     AI recommendations

### **Escalations**

GET    /api/escalations                  List open escalationsGET    /api/escalations/:id               Get escalation detailsPOST   /api/escalations/:id/acknowledge   Acknowledge receiptPOST   /api/escalations/:id/resolve       Resolve with responsePOST   /api/escalations/:id/dismiss       Dismiss (false alarm)

### **Webhooks (External)**

POST   /api/webhooks/meta               Meta webhook receiverPOST   /api/webhooks/conversion          Conversion tracking endpointGET    /api/webhooks/pixel.js            Dynamic pixel script

# **5\. Core System Components**

## **5.1 Content Generation Engine**

**Purpose:** Generate message variations from playbook, match with appropriate images, format for each platform.

**Process:**

1. Load active playbook for campaign  
2. Select hook(s) to test based on strategy  
3. Call Claude API with playbook context \+ hook \+ audience segment  
4. Generate N variations (headline, body, CTA combinations)  
5. Score each variation against brand voice, clarity, hook alignment  
6. Match to images using tag alignment algorithm  
7. If no suitable image exists, create image\_request  
8. Generate platform-specific variants (character limits, specs)  
9. Store in content table with generation metadata

## **5.2 Image Matching Algorithm**

**Purpose:** Intelligently pair generated messages with library images.

**Matching Criteria (weighted):**

* **Segment match (40%):** TIA Seeker content → TIA-tagged images  
* **Emotion match (30%):** Achievement message → Achievement-tagged image  
* **Theme match (20%):** ROI hook → Money/reward visual  
* **Usage balance (10%):** Prefer less-used images to maintain variety

**Output:** Ranked list of suitable images with match scores. If top score \< threshold, trigger image\_request.

## **5.3 Distribution Scheduler**

**Purpose:** Manage posting schedule across platforms, handle rate limits, retry failures.

**Functions:**

* Queue content for optimal posting times (configurable per platform)  
* Manage A/B test distribution (equal exposure for variations)  
* Handle Meta API rate limits and retries  
* Track post status (scheduled → posted → confirmed)  
* Log failures and escalate persistent issues

## **5.4 Performance Analyzer**

**Purpose:** Collect metrics, calculate performance scores, identify winners/losers.

**Data Collection:**

* Poll Meta API for engagement metrics (hourly during active campaigns)  
* Receive conversion events via webhook/pixel  
* Attribute conversions to content via UTM parameters

**Performance Score Calculation:**

score \= (conversion\_weight \* conversions) \+         (engagement\_weight \* engagement\_rate) \+         (click\_weight \* ctr) \-         (cost\_weight \* cpa)// Weights configurable per campaign based on goals// Default: conversions=0.5, engagement=0.2, clicks=0.2, cost=0.1

## **5.5 Optimization Engine**

**Purpose:** Autonomously adjust campaigns based on performance data.

**Decision Logic:**

| State | Autonomous Action |
| :---- | :---- |
| **EXCEEDING** | Increase budget allocation to top performers. Generate more variations of winning hooks. Expand to similar audiences. Do NOT change what's working. |
| **MEETING** | Continue current approach. Test small variations (new images, CTA tweaks). Collect more data before major changes. |
| **BELOW** | Reduce/pause underperformers. Shift budget to better content. Generate new variations using different hooks. Test new audiences. |
| **PERSISTENT FAIL** | Pause campaign. Create escalation. AI generates analysis: Is this messaging, targeting, or product/market fit issue? Await human decision. |

**Threshold Definitions (configurable per campaign):**

{  "exceeding": { "ctr": "\>3%", "conversion\_rate": "\>10%", "cpa": "\<$50" },  "meeting": { "ctr": "1-3%", "conversion\_rate": "2-10%", "cpa": "$50-100" },  "below": { "ctr": "\<1%", "conversion\_rate": "\<2%", "cpa": "\>$100" },  "persistent\_failure\_days": 14}

## **5.6 Escalation Manager**

**Purpose:** Surface issues requiring human judgment. Provide AI analysis and recommendations.

**Escalation Triggers:**

* **below\_threshold:** Campaign performing below minimum for 7+ days  
* **persistent\_failure:** Multiple optimization attempts haven't improved results  
* **budget\_depleted:** Campaign spent budget before achieving goals  
* **anomaly\_detected:** Unusual patterns (sudden drop, suspicious activity)  
* **strategic\_question:** Decision requires business context AI doesn't have

**Escalation Content:** Each escalation includes: description of issue, relevant metrics snapshot, AI analysis of potential causes, AI recommendation, and action options for human.

# **6\. User Interface**

## **6.1 Dashboard Views**

* **Home Dashboard:** Active campaigns, pending tasks, open escalations, quick stats  
* **Business View:** Switch between businesses, see business-specific metrics  
* **Playbook Manager:** Create, edit, activate playbooks  
* **Campaign Center:** Campaign list, status, quick actions  
* **Campaign Detail:** Full campaign view with content, performance, timeline  
* **Content Library:** All generated content, filter by status/performance  
* **Image Library:** Upload, tag, manage images; see pending requests  
* **Task Manager:** Your tasks vs. system tasks, completion tracking  
* **Analytics:** Deep dive into performance metrics, trends, comparisons  
* **Escalations:** Open issues requiring attention, with AI context

## **6.2 Key User Flows**

**Flow 1: New Campaign Setup**

Select Business → Select/Create Playbook → Create Campaign  → Define targets (audience, markets, budget)  → Review generated content preview  → Approve campaign (status: approved)  → System generates human\_tasks and ai\_tasks  → Complete your tasks / System completes its tasks  → Both complete → Launch campaign (status: live)

**Flow 2: Handle Escalation**

Notification of escalation → View escalation details  → Read AI analysis and recommendation  → Choose: Accept recommendation / Provide different direction / Dismiss  → If accept: System implements  → If different: Enter guidance → System adapts

**Flow 3: Fulfill Image Request**

View pending image requests → See AI-generated prompt  → Create image externally (Midjourney, etc.)  → Upload to Image Library with suggested tags  → Mark request fulfilled → Link to uploaded image  → System updates content that was waiting

# **7\. Sprint Plan**

## **Sprint 1: Foundation (Week 1-2)**

**Goal:** Core infrastructure, database, basic UI shell

* Next.js project setup with App Router  
* PostgreSQL database \+ Prisma schema (all tables)  
* Basic authentication (password-protected)  
* Dashboard layout with navigation  
* Business CRUD (create Melissa, Vaquero)  
* Image upload \+ S3/R2 storage integration

## **Sprint 2: Playbook \+ Content (Week 3-4)**

**Goal:** Playbook management, content generation engine

* Playbook CRUD with structured sections  
* Claude API integration for content generation  
* Content generation from playbook (batch creation)  
* Image tagging system  
* Image matching algorithm  
* Image request workflow  
* Content preview UI

## **Sprint 3: Campaign \+ Tasks (Week 5-6)**

**Goal:** Campaign lifecycle, task management

* Campaign creation from playbook  
* Campaign status workflow (draft → live)  
* Task generation on campaign approval  
* Task management UI (human vs. system tasks)  
* Campaign detail view  
* Activity logging

## **Sprint 4: Meta Integration (Week 7-8)**

**Goal:** Connect to Meta, post content, track basic metrics

* Meta Business API OAuth setup  
* Facebook Page \+ Instagram connection  
* Post scheduling (BullMQ jobs)  
* Posting to Facebook/Instagram  
* Engagement metrics polling  
* UTM parameter generation  
* Basic conversion webhook

## **Sprint 5: Analytics \+ Optimization (Week 9-10)**

**Goal:** Performance tracking, optimization engine, escalations

* Performance analyzer (score calculation)  
* Conversion attribution  
* Analytics dashboard  
* Optimization engine (auto-adjustments)  
* Threshold monitoring  
* Escalation system  
* AI recommendation generation

## **Sprint 6: Polish \+ Launch (Week 11-12)**

**Goal:** Production readiness, Melissa campaign launch

* Load Melissa playbook into system  
* Upload initial image library  
* Create first campaign  
* End-to-end testing  
* Bug fixes and refinements  
* Production deployment  
* Launch Melissa campaign

# **8\. Environment Configuration**

## **8.1 Required Environment Variables**

\# DatabaseDATABASE\_URL=postgresql://user:pass@host:5432/campaign\_engine\# AuthenticationAUTH\_SECRET=your-secret-keyADMIN\_PASSWORD=your-admin-password\# AnthropicANTHROPIC\_API\_KEY=sk-ant-...\# Meta BusinessMETA\_APP\_ID=your-app-idMETA\_APP\_SECRET=your-app-secret\# Storage (choose one)AWS\_ACCESS\_KEY\_ID=...AWS\_SECRET\_ACCESS\_KEY=...AWS\_S3\_BUCKET=campaign-engine-images\# OR Cloudflare R2R2\_ACCESS\_KEY\_ID=...R2\_SECRET\_ACCESS\_KEY=...R2\_BUCKET=campaign-engine-images\# Redis (for job queue)REDIS\_URL=redis://localhost:6379\# AppNEXT\_PUBLIC\_APP\_URL=https://your-domain.com

## **8.2 Initial Setup Steps**

10. Clone repository and install dependencies  
11. Set up PostgreSQL database  
12. Configure environment variables  
13. Run Prisma migrations  
14. Set up Redis for job queue  
15. Configure S3/R2 bucket for image storage  
16. Create Meta Business App and configure OAuth  
17. Deploy to hosting platform  
18. Create first business and playbook

*End of Technical Architecture Document*
