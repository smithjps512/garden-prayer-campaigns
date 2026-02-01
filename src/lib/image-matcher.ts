import prisma from './prisma'
import { Prisma } from '@prisma/client'

export interface ImageTags {
  segments?: string[]
  emotions?: string[]
  themes?: string[]
}

export interface MatchCriteria {
  audienceSegment?: string
  emotion?: string
  theme?: string
  businessId: string
}

export interface ImageMatch {
  imageId: string
  filename: string
  storageUrl: string
  thumbnailUrl: string | null
  score: number
  matchDetails: {
    segmentMatch: number
    emotionMatch: number
    themeMatch: number
    usageScore: number
  }
}

// Weights for matching algorithm
const WEIGHTS = {
  segment: 0.4, // 40%
  emotion: 0.3, // 30%
  theme: 0.2,   // 20%
  usage: 0.1,   // 10%
}

// Minimum score threshold to consider a match
const MIN_MATCH_THRESHOLD = 0.3

/**
 * Find matching images for content based on tags
 */
export async function findMatchingImages(
  criteria: MatchCriteria,
  limit: number = 5
): Promise<ImageMatch[]> {
  // Get all images for the business
  const images = await prisma.image.findMany({
    where: { businessId: criteria.businessId },
    orderBy: { usageCount: 'asc' }, // Prefer less-used images
  })

  if (images.length === 0) {
    return []
  }

  // Calculate max usage count for normalization
  const maxUsage = Math.max(...images.map((img) => img.usageCount), 1)

  // Score each image
  const scored: ImageMatch[] = images.map((image) => {
    const tags = (image.tags as ImageTags) || {}
    const matchDetails = {
      segmentMatch: 0,
      emotionMatch: 0,
      themeMatch: 0,
      usageScore: 0,
    }

    // Segment match (40%)
    if (criteria.audienceSegment && tags.segments) {
      const normalizedSegment = criteria.audienceSegment.toLowerCase().replace(/[^a-z0-9]/g, '_')
      const segmentMatches = tags.segments.some(
        (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '_').includes(normalizedSegment) ||
               normalizedSegment.includes(s.toLowerCase().replace(/[^a-z0-9]/g, '_'))
      )
      matchDetails.segmentMatch = segmentMatches ? 1 : 0
    }

    // Emotion match (30%)
    if (criteria.emotion && tags.emotions) {
      const normalizedEmotion = criteria.emotion.toLowerCase()
      const emotionMatches = tags.emotions.some(
        (e) => e.toLowerCase().includes(normalizedEmotion) ||
               normalizedEmotion.includes(e.toLowerCase())
      )
      matchDetails.emotionMatch = emotionMatches ? 1 : 0
    }

    // Theme match (20%)
    if (criteria.theme && tags.themes) {
      const normalizedTheme = criteria.theme.toLowerCase()
      const themeMatches = tags.themes.some(
        (t) => t.toLowerCase().includes(normalizedTheme) ||
               normalizedTheme.includes(t.toLowerCase())
      )
      matchDetails.themeMatch = themeMatches ? 1 : 0
    }

    // Usage score (10%) - prefer less used images
    matchDetails.usageScore = 1 - (image.usageCount / maxUsage)

    // Calculate weighted score
    const score =
      matchDetails.segmentMatch * WEIGHTS.segment +
      matchDetails.emotionMatch * WEIGHTS.emotion +
      matchDetails.themeMatch * WEIGHTS.theme +
      matchDetails.usageScore * WEIGHTS.usage

    return {
      imageId: image.id,
      filename: image.filename,
      storageUrl: image.storageUrl,
      thumbnailUrl: image.thumbnailUrl,
      score,
      matchDetails,
    }
  })

  // Sort by score descending and filter by threshold
  return scored
    .filter((match) => match.score >= MIN_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

/**
 * Auto-match image to content based on content metadata
 */
export async function autoMatchImageToContent(contentId: string): Promise<ImageMatch | null> {
  const content = await prisma.content.findUnique({
    where: { id: contentId },
    include: {
      campaign: {
        include: {
          playbook: {
            include: {
              business: true,
            },
          },
        },
      },
    },
  })

  if (!content || !content.campaign?.playbook) {
    return null
  }

  // Extract matching criteria from content
  const criteria: MatchCriteria = {
    businessId: content.campaign.playbook.businessId,
    audienceSegment: content.audienceSegment || undefined,
  }

  // Try to infer emotion from hook or content
  if (content.hookSource) {
    const hooks = content.campaign.playbook.hooks as Array<{ id: string; angle?: string }> | null
    const hook = hooks?.find((h) => h.id === content.hookSource)
    if (hook?.angle) {
      // Map angles to emotions
      const angleToEmotion: Record<string, string> = {
        'fear of missing out': 'urgency',
        'fomo': 'urgency',
        'social proof': 'trust',
        'authority': 'trust',
        'scarcity': 'urgency',
        'curiosity': 'discovery',
        'pain point': 'relief',
        'aspiration': 'achievement',
        'transformation': 'achievement',
        'roi': 'success',
        'savings': 'relief',
      }

      const normalizedAngle = hook.angle.toLowerCase()
      for (const [key, emotion] of Object.entries(angleToEmotion)) {
        if (normalizedAngle.includes(key)) {
          criteria.emotion = emotion
          break
        }
      }
    }
  }

  // Try to infer theme from content body
  if (content.body) {
    const body = content.body.toLowerCase()
    const themeKeywords: Record<string, string[]> = {
      roi: ['roi', 'return', 'investment', 'money', 'save', 'earn', 'profit'],
      feature: ['feature', 'tool', 'function', 'capability', 'solution'],
      story: ['story', 'journey', 'experience', 'life', 'changed'],
      comparison: ['better', 'versus', 'compare', 'unlike', 'different'],
      testimonial: ['said', 'told', 'according', 'customer', 'user'],
    }

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      if (keywords.some((kw) => body.includes(kw))) {
        criteria.theme = theme
        break
      }
    }
  }

  const matches = await findMatchingImages(criteria, 1)
  return matches[0] || null
}

/**
 * Increment usage count when image is used
 */
export async function incrementImageUsage(imageId: string): Promise<void> {
  await prisma.image.update({
    where: { id: imageId },
    data: { usageCount: { increment: 1 } },
  })
}

/**
 * Create image request when no suitable image found
 */
export async function createImageRequest(
  businessId: string,
  campaignId: string | null,
  description: string,
  suggestedTags: ImageTags,
  priority: number = 5
): Promise<string> {
  // Generate a prompt suggestion for image creation
  const promptParts: string[] = []

  if (suggestedTags.segments?.length) {
    promptParts.push(`Target audience: ${suggestedTags.segments.join(', ')}`)
  }
  if (suggestedTags.emotions?.length) {
    promptParts.push(`Emotion to convey: ${suggestedTags.emotions.join(', ')}`)
  }
  if (suggestedTags.themes?.length) {
    promptParts.push(`Theme: ${suggestedTags.themes.join(', ')}`)
  }

  const suggestedPrompt = promptParts.length > 0
    ? `Create a marketing image. ${promptParts.join('. ')}. ${description}`
    : description

  const request = await prisma.imageRequest.create({
    data: {
      businessId,
      campaignId,
      description,
      suggestedPrompt,
      suggestedTags: suggestedTags as unknown as Prisma.InputJsonValue,
      priority,
      status: 'pending',
    },
  })

  return request.id
}
