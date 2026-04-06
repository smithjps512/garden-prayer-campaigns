import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface PlaybookContext {
  businessName: string
  positioning: string
  founderStory?: string
  audiences: AudienceSegment[]
  hooks: Hook[]
  keyMessages?: Record<string, string[]>
  objectionHandlers?: Record<string, string>
  visualDirection?: Record<string, unknown>
}

export interface AudienceSegment {
  name: string
  description: string
  painPoints: string[]
  desires: string[]
  objections?: string[]
}

export interface Hook {
  id: string
  text: string
  angle: string
  targetAudience?: string
}

export interface ContentVariation {
  headline: string
  body: string
  ctaText: string
  hookSource: string
  audienceSegment: string
  platform: 'facebook' | 'instagram'
  pillar?: string
  archetype?: string
  reasoning?: string
}

export interface GenerationRequest {
  playbook: PlaybookContext
  targetAudience: string
  hooks: Hook[]
  contentType: 'ad' | 'organic_post' | 'story'
  platform: 'facebook' | 'instagram' | 'both'
  count: number
}

export interface GenerationResponse {
  variations: ContentVariation[]
  metadata: {
    model: string
    tokensUsed: number
    generatedAt: string
  }
}

const CONTENT_GENERATION_PROMPT = `You are an expert social media copywriter creating content for a marketing campaign.

BUSINESS CONTEXT:
Business: {{businessName}}
Positioning: {{positioning}}
{{#founderStory}}
Founder Story: {{founderStory}}
{{/founderStory}}

TARGET AUDIENCE: {{audienceName}}
Description: {{audienceDescription}}
Pain Points: {{painPoints}}
Desires: {{desires}}

HOOKS TO USE:
{{hooks}}

CONTENT TYPE: {{contentType}}
PLATFORM: {{platform}}

Generate {{count}} unique content variations. Each variation should:
1. Lead with one of the provided hooks
2. Speak directly to the target audience's pain points and desires
3. Use conversational, authentic language (not corporate speak)
4. Include a clear call-to-action
5. Be optimized for {{platform}} (character limits, tone, style)

For Facebook:
- Headlines: Max 40 characters for best engagement
- Body: 125-250 characters for feed posts, can be longer for ads
- Use emojis sparingly and appropriately

For Instagram:
- Headlines: Max 40 characters
- Body: 125-150 characters for feed, can use more in caption
- More emoji-friendly, casual tone

IMPORTANT: Each variation MUST be written specifically for the target audience above. Use their exact pain points, desires, and language. Do NOT produce generic copy that could apply to any audience.

For each variation, classify it with:
- pillar: The core value pillar it maps to. Infer the best-fit pillar from the business positioning and audience context. Use a short kebab-case slug (e.g., "time-back", "immersion", "creation-speed").
- archetype: The content archetype. One of: "pain-point", "stat-proof", "contrast", "aspiration", "myth-buster", "transformation", "curiosity-hook", "outcome". Pick based on the rhetorical approach used.

Respond in JSON format:
{
  "variations": [
    {
      "headline": "Attention-grabbing headline",
      "body": "Main body text with value proposition",
      "ctaText": "Call to action button text",
      "hookSource": "ID of the hook used",
      "audienceSegment": "Target audience name",
      "platform": "facebook or instagram",
      "pillar": "time-back",
      "archetype": "pain-point",
      "reasoning": "Brief explanation of why this variation works"
    }
  ]
}

Generate exactly {{count}} variations, mixing the hooks provided.`

/**
 * Find an audience segment by name using case-insensitive matching.
 * Returns undefined if not found.
 */
export function findAudienceSegment(
  audiences: AudienceSegment[],
  name: string
): AudienceSegment | undefined {
  const trimmed = name.trim()
  return audiences.find((a) => a.name.toLowerCase() === trimmed.toLowerCase())
}

/**
 * Parse a target audience value that may be a comma-separated string or a single segment name.
 * Returns an array of trimmed, non-empty segment names.
 */
export function parseTargetAudiences(targetAudience: string): string[] {
  return targetAudience
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

function buildPrompt(request: GenerationRequest): string {
  const { playbook, targetAudience, hooks, contentType, platform, count } = request

  const audience = findAudienceSegment(playbook.audiences, targetAudience)
  if (!audience) {
    const available = playbook.audiences.map((a) => a.name).join(', ')
    throw new Error(
      `Audience segment "${targetAudience}" not found in playbook. Available segments: ${available}`
    )
  }

  const hooksText = hooks.map((h) => `- [${h.id}] "${h.text}" (Angle: ${h.angle})`).join('\n')

  let prompt = CONTENT_GENERATION_PROMPT
    .replace('{{businessName}}', playbook.businessName)
    .replace('{{positioning}}', playbook.positioning)
    .replace('{{audienceName}}', audience.name)
    .replace('{{audienceDescription}}', audience.description)
    .replace('{{painPoints}}', audience.painPoints.join(', '))
    .replace('{{desires}}', audience.desires.join(', '))
    .replace('{{hooks}}', hooksText)
    .replace('{{contentType}}', contentType)
    .replace(/\{\{platform\}\}/g, platform === 'both' ? 'Facebook and Instagram' : platform)
    .replace(/\{\{count\}\}/g, count.toString())

  // Handle optional founder story
  if (playbook.founderStory) {
    prompt = prompt.replace('{{#founderStory}}', '').replace('{{/founderStory}}', '')
    prompt = prompt.replace('{{founderStory}}', playbook.founderStory)
  } else {
    prompt = prompt.replace(/\{\{#founderStory\}\}[\s\S]*?\{\{\/founderStory\}\}/g, '')
  }

  return prompt
}

export async function generateContent(request: GenerationRequest): Promise<GenerationResponse> {
  const prompt = buildPrompt(request)

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  })

  // Extract text content
  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response
  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  return {
    variations: parsed.variations,
    metadata: {
      model: message.model,
      tokensUsed: message.usage.input_tokens + message.usage.output_tokens,
      generatedAt: new Date().toISOString(),
    },
  }
}

// Generate playbook from a brief
export async function generatePlaybookFromBrief(brief: {
  businessName: string
  industry: string
  product: string
  pricePoint: string
  targetMarket: string
  competitors?: string
  uniqueValue: string
  founderStory?: string
}): Promise<Partial<PlaybookContext>> {
  const prompt = `You are a marketing strategist creating a comprehensive marketing playbook.

BUSINESS BRIEF:
- Business Name: ${brief.businessName}
- Industry: ${brief.industry}
- Product/Service: ${brief.product}
- Price Point: ${brief.pricePoint}
- Target Market: ${brief.targetMarket}
${brief.competitors ? `- Key Competitors: ${brief.competitors}` : ''}
- Unique Value Proposition: ${brief.uniqueValue}
${brief.founderStory ? `- Founder Story: ${brief.founderStory}` : ''}

Create a marketing playbook with:

1. POSITIONING: A clear, compelling positioning statement (2-3 sentences)

2. AUDIENCES: 3-4 distinct audience segments, each with:
   - name: Short identifier (e.g., "Budget-Conscious Beginners")
   - description: Who they are (1-2 sentences)
   - painPoints: 3-4 specific pain points
   - desires: 3-4 specific desires/goals
   - objections: 2-3 likely objections to purchasing

3. HOOKS: 8-10 attention-grabbing hooks/angles, each with:
   - id: Unique identifier (e.g., "hook_roi_1")
   - text: The actual hook text
   - angle: The emotional/logical angle (e.g., "fear of missing out", "social proof")
   - targetAudience: Which audience segment this resonates with most

4. KEY_MESSAGES: For each audience segment, 3-4 key messages that resonate

5. OBJECTION_HANDLERS: Common objections and how to address them

Respond in JSON format with this structure:
{
  "positioning": "...",
  "audiences": [...],
  "hooks": [...],
  "keyMessages": {...},
  "objectionHandlers": {...}
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}

// =============================================================================
// Content Classification (Backfill Tags)
// =============================================================================

/**
 * Classify existing content into pillar and archetype categories.
 * Used for backfilling untagged content.
 */
export async function classifyContentTags(
  headline: string,
  body: string
): Promise<{ pillar: string; archetype: string }> {
  const prompt = `Classify the following social media content for an EdTech product (Melissa for Educators — AI teaching assistant).

CONTENT:
Headline: ${headline}
Body: ${body}

Classify into exactly one pillar and one archetype.

PILLARS (pick the primary value angle):
- "time-back" — saves teachers time, reduces workload, automates tedious tasks
- "bigger-paycheck" — increases earning potential (TIA/merit pay), improves evaluation scores
- "not-chatgpt" — built specifically for educators, not generic AI, understands teaching context

ARCHETYPES (pick the rhetorical approach):
- "pain-point" — highlights a specific frustration teachers face
- "stat-proof" — leads with data, statistics, or measurable outcomes
- "contrast" — before/after, with/without comparison
- "aspiration" — paints a picture of the desired future state
- "myth-buster" — challenges a common misconception
- "teacher-reality" — day-in-the-life, relatable daily scenarios
- "individualization" — focuses on personalized/differentiated instruction
- "outcome" — focuses on student or teacher results/achievements

Respond in JSON only:
{"pillar": "...", "archetype": "..."}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}

// =============================================================================
// AI Recommendation Generation
// =============================================================================

export interface RecommendationInput {
  businessName: string
  messageMatrix: {
    byPillar: Array<{ pillar: string; avgScore: number; contentCount: number }>
    byArchetype: Array<{ archetype: string; avgScore: number; contentCount: number }>
    byAudience: Array<{ audience: string; avgScore: number; contentCount: number }>
    topCombinations: Array<{ pillar: string; archetype: string; audience: string; avgScore: number }>
    bottomCombinations: Array<{ pillar: string; archetype: string; audience: string; avgScore: number }>
    untestedCombinations: Array<{ pillar: string; archetype: string; audience: string }>
  }
  recentGenerationHistory: Array<{ pillar: string; archetype: string; audience: string; createdAt: string }>
}

export interface RecommendationOutput {
  amplify: Array<{ title: string; reasoning: string; pillar: string; archetype: string; audience: string }>
  retire: Array<{ title: string; reasoning: string; contentIds?: string[] }>
  test: Array<{ title: string; reasoning: string; pillar: string; archetype: string; audience: string }>
  iterate: Array<{ title: string; reasoning: string; pillar: string; archetype: string; audience: string; winningAngle: string }>
}

export async function generateRecommendations(
  input: RecommendationInput
): Promise<RecommendationOutput> {
  const prompt = `You are a marketing strategist analyzing content performance data for "${input.businessName}" and generating actionable recommendations.

MESSAGE EFFECTIVENESS DATA:
${JSON.stringify(input.messageMatrix, null, 2)}

RECENT GENERATION HISTORY (last 20 content pieces):
${JSON.stringify(input.recentGenerationHistory, null, 2)}

Based on this data, generate recommendations in 4 categories:

1. AMPLIFY: High-performing content combinations to generate more variations of. Pick the best pillar/archetype/audience combos and recommend creating more.

2. RETIRE: Underperforming content to stop using. Identify weak patterns (not individual pieces). If specific low scorers stand out, reference the pattern.

3. TEST: Untested pillar/archetype/audience combinations that are worth trying. Prioritize combinations adjacent to known winners.

4. ITERATE: Top performers to explore further variations of. Identify the winning angle and suggest how to riff on it.

Rules:
- Generate 1-3 recommendations per category (fewer is fine if data is sparse)
- Be specific about which pillar/archetype/audience to target
- Provide clear reasoning based on the data
- If there isn't enough data for a category, return an empty array for it

Respond in JSON:
{
  "amplify": [{"title": "...", "reasoning": "...", "pillar": "...", "archetype": "...", "audience": "..."}],
  "retire": [{"title": "...", "reasoning": "..."}],
  "test": [{"title": "...", "reasoning": "...", "pillar": "...", "archetype": "...", "audience": "..."}],
  "iterate": [{"title": "...", "reasoning": "...", "pillar": "...", "archetype": "...", "audience": "...", "winningAngle": "..."}]
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}

// Analyze content performance and suggest improvements
export async function analyzeContentPerformance(content: {
  headline: string
  body: string
  metrics: {
    impressions: number
    clicks: number
    conversions: number
    spend?: number
  }
  businessContext: string
}): Promise<{
  analysis: string
  suggestions: string[]
  predictedImprovement: string
}> {
  const ctr = content.metrics.clicks / content.metrics.impressions
  const convRate = content.metrics.conversions / content.metrics.clicks

  const prompt = `Analyze this social media content performance:

CONTENT:
Headline: ${content.headline}
Body: ${content.body}

METRICS:
- Impressions: ${content.metrics.impressions}
- Clicks: ${content.metrics.clicks} (CTR: ${(ctr * 100).toFixed(2)}%)
- Conversions: ${content.metrics.conversions} (Conv Rate: ${(convRate * 100).toFixed(2)}%)
${content.metrics.spend ? `- Spend: $${content.metrics.spend} (CPA: $${(content.metrics.spend / content.metrics.conversions).toFixed(2)})` : ''}

BUSINESS CONTEXT: ${content.businessContext}

Provide:
1. Analysis of why this content is performing at this level
2. 3-4 specific suggestions to improve performance
3. Predicted improvement if suggestions are implemented

Respond in JSON:
{
  "analysis": "...",
  "suggestions": ["...", "..."],
  "predictedImprovement": "..."
}`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  const jsonMatch = textContent.text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  return JSON.parse(jsonMatch[0])
}
