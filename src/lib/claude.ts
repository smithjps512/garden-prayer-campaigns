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
      "reasoning": "Brief explanation of why this variation works"
    }
  ]
}

Generate exactly {{count}} variations, mixing the hooks provided.`

function buildPrompt(request: GenerationRequest): string {
  const { playbook, targetAudience, hooks, contentType, platform, count } = request

  const audience = playbook.audiences.find((a) => a.name === targetAudience)
  if (!audience) {
    throw new Error(`Audience segment "${targetAudience}" not found in playbook`)
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
