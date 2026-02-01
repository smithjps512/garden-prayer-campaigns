import Anthropic from '@anthropic-ai/sdk'
import mammoth from 'mammoth'
import pdf from 'pdf-parse'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export interface ParsedPlaybook {
  name: string
  positioning: string | null
  founderStory: string | null
  audiences: AudienceSegment[]
  keyMessages: Record<string, string[]>
  objectionHandlers: Record<string, string>
  hooks: Hook[]
  visualDirection: VisualDirection | null
  content: PlaybookContent | null
}

export interface AudienceSegment {
  name: string
  description: string
  painPoints: string[]
  desires: string[]
  objections?: string[]
  demographics?: string
  psychographics?: string
}

export interface Hook {
  id: string
  text: string
  angle: string
  targetAudience?: string
  emotion?: string
}

export interface VisualDirection {
  brandColors?: Record<string, string>
  imageStyle?: string
  tone?: string
  doNots?: string[]
  guidelines?: string[]
}

export interface PlaybookContent {
  campaignStructure?: CampaignStructure[]
  taskAssignments?: TaskAssignment[]
  targetMarkets?: string[]
  successMetrics?: Record<string, number | string>
  competitiveAnalysis?: CompetitorInfo[]
  imageRequirements?: string[]
}

export interface CampaignStructure {
  name: string
  type: string
  audience: string
  duration?: string
  budget?: string
  channels?: string[]
}

export interface TaskAssignment {
  task: string
  assignee: 'human' | 'system'
  priority?: number
  description?: string
}

export interface CompetitorInfo {
  name: string
  strengths?: string[]
  weaknesses?: string[]
  positioning?: string
}

// Parse a single file based on its type
async function parseFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  const buffer = Buffer.from(await file.arrayBuffer())

  switch (ext) {
    case 'pdf':
      return parsePdf(buffer)
    case 'docx':
      return parseDocx(buffer)
    case 'txt':
    case 'md':
      return buffer.toString('utf-8')
    default:
      throw new Error(`Unsupported file type: ${ext}`)
  }
}

async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await pdf(buffer)
  return data.text
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer })
  return result.value
}

// Main function to parse documents and extract playbook
export async function parseDocumentsToPlaybook(
  files: File[],
  businessName: string
): Promise<ParsedPlaybook> {
  // Parse all files and combine content
  const parsedContents = await Promise.all(
    files.map(async (file) => {
      const content = await parseFile(file)
      return `\n--- Document: ${file.name} ---\n${content}`
    })
  )

  const combinedContent = parsedContents.join('\n\n')

  // Send to Claude for structured extraction
  const playbook = await extractPlaybookWithClaude(combinedContent, businessName)

  return playbook
}

async function extractPlaybookWithClaude(
  documentContent: string,
  businessName: string
): Promise<ParsedPlaybook> {
  const prompt = `You are an expert marketing strategist analyzing business documents to create a structured marketing playbook.

BUSINESS: ${businessName}

UPLOADED DOCUMENTS:
${documentContent}

Analyze these documents and extract a comprehensive marketing playbook. Extract ALL relevant information you can find. If information for a section is not present, use null or empty arrays.

Return a JSON object with this exact structure:
{
  "name": "Suggested playbook name based on content",
  "positioning": "The core positioning statement/value proposition (2-3 sentences, or null if not found)",
  "founderStory": "The founder's story or company origin story (or null if not found)",
  "audiences": [
    {
      "name": "Segment name (e.g., 'Budget-Conscious Teachers')",
      "description": "Who they are (1-2 sentences)",
      "painPoints": ["Pain point 1", "Pain point 2", ...],
      "desires": ["Desire 1", "Desire 2", ...],
      "objections": ["Objection 1", ...],
      "demographics": "Age, location, profession, etc. (or null)",
      "psychographics": "Values, interests, lifestyle (or null)"
    }
  ],
  "keyMessages": {
    "Segment Name": ["Key message 1", "Key message 2", ...]
  },
  "objectionHandlers": {
    "Objection text": "Response/counter"
  },
  "hooks": [
    {
      "id": "hook_1",
      "text": "The actual hook/headline text",
      "angle": "The approach (e.g., 'social proof', 'fear of missing out', 'transformation')",
      "targetAudience": "Which segment this targets (or null)",
      "emotion": "Primary emotion evoked (or null)"
    }
  ],
  "visualDirection": {
    "brandColors": {"primary": "#hexcode", "secondary": "#hexcode", ...},
    "imageStyle": "Description of image/visual style",
    "tone": "Brand voice/tone description",
    "doNots": ["Things to avoid"],
    "guidelines": ["Brand guidelines"]
  },
  "content": {
    "campaignStructure": [
      {
        "name": "Campaign name",
        "type": "awareness/conversion/retention",
        "audience": "Target segment",
        "duration": "2 weeks",
        "budget": "$500/day",
        "channels": ["facebook", "instagram"]
      }
    ],
    "taskAssignments": [
      {
        "task": "Task description",
        "assignee": "human or system",
        "priority": 1-10,
        "description": "Detailed instructions"
      }
    ],
    "targetMarkets": ["Market 1", "Market 2"],
    "successMetrics": {
      "subscribers": 15,
      "cac": 100,
      "ctr": "2%"
    },
    "competitiveAnalysis": [
      {
        "name": "Competitor name",
        "strengths": ["..."],
        "weaknesses": ["..."],
        "positioning": "Their positioning"
      }
    ],
    "imageRequirements": ["Image need 1", "Image need 2"]
  }
}

IMPORTANT INSTRUCTIONS:
1. Extract as much information as possible from the documents
2. If a section has no relevant data, use null or empty arrays - don't make things up
3. For hooks, extract any attention-grabbing phrases, headlines, or angles mentioned
4. For audiences, look for customer personas, target demographics, ideal customer profiles
5. For objections, look for FAQ sections, concerns addressed, barriers to purchase
6. Be thorough - marketing playbooks often have valuable information scattered throughout
7. Maintain the exact JSON structure shown above

Respond with ONLY the JSON object, no additional text.`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8192,
    messages: [{ role: 'user', content: prompt }],
  })

  const textContent = message.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON response - handle potential markdown code blocks
  let jsonText = textContent.text.trim()

  // Remove markdown code blocks if present
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.slice(7)
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.slice(3)
  }
  if (jsonText.endsWith('```')) {
    jsonText = jsonText.slice(0, -3)
  }
  jsonText = jsonText.trim()

  // Try to find JSON object
  const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    throw new Error('Could not parse JSON from Claude response')
  }

  const parsed = JSON.parse(jsonMatch[0])

  // Validate and provide defaults
  return {
    name: parsed.name || `${businessName} Playbook`,
    positioning: parsed.positioning || null,
    founderStory: parsed.founderStory || null,
    audiences: Array.isArray(parsed.audiences) ? parsed.audiences : [],
    keyMessages: parsed.keyMessages || {},
    objectionHandlers: parsed.objectionHandlers || {},
    hooks: Array.isArray(parsed.hooks) ? parsed.hooks : [],
    visualDirection: parsed.visualDirection || null,
    content: parsed.content || null,
  }
}
