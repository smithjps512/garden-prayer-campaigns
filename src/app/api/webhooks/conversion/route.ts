import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'

/**
 * POST /api/webhooks/conversion
 *
 * Receives conversion events from UTM-tagged traffic, Clerk signups, and
 * Stripe purchases. Maps events back to Campaign and Content, creates
 * a Conversion record.
 *
 * Accepts two payload shapes:
 *
 * 1. UTM-based (original):
 *    { type, utm_source, utm_medium, utm_campaign, utm_content, value?, ... }
 *
 * 2. Integration-based (Clerk/Stripe):
 *    { type, source: "clerk"|"stripe", campaignSlug?, userId?, amount?, currency?, ... }
 *    May also include utm_* params from cookie attribution.
 *
 * No auth required (webhook endpoint) but validates payload structure.
 */
export async function POST(request: NextRequest) {
  try {
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return errorResponse('Invalid JSON payload', 400)
    }

    const data = body as Record<string, unknown>

    // Validate required fields
    const type = data.type as string | undefined
    if (!type || !['click', 'signup', 'trial', 'purchase'].includes(type)) {
      return errorResponse(
        'Invalid or missing "type". Must be one of: click, signup, trial, purchase',
        400
      )
    }

    // Support both naming conventions for UTM params
    const utmSource = (data.utm_source || data.utmSource || data.source) as string | undefined
    const utmMedium = (data.utm_medium || data.utmMedium) as string | undefined
    const utmCampaign = (data.utm_campaign || data.utmCampaign || data.campaignSlug) as string | undefined
    const utmContent = (data.utm_content || data.utmContent) as string | undefined

    // Integration-specific fields (Clerk/Stripe payloads)
    const source = data.source as string | undefined // "clerk", "stripe", etc.
    const campaignSlug = data.campaignSlug as string | undefined
    const amount = data.amount !== undefined ? Number(data.amount) : undefined
    const currency = data.currency as string | undefined

    if (!utmSource) {
      return errorResponse('Missing utm_source (or source) parameter', 400)
    }

    // Optional fields
    const value = data.value !== undefined ? Number(data.value) : amount
    const sessionId = data.sessionId as string | undefined
    const userAgent = data.userAgent as string | undefined
    const ipAddress = data.ipAddress as string | undefined
    const geoMarket = data.geoMarket as string | undefined

    // Try to map UTM params back to campaign and content
    let campaignId: string | undefined
    let contentId: string | undefined
    let postId: string | undefined
    let businessId: string | undefined

    // Map utm_content to content ID (we store content ID in utm_content)
    if (utmContent) {
      const content = await prisma.content.findUnique({
        where: { id: utmContent },
        select: {
          id: true,
          campaignId: true,
          campaign: {
            select: {
              playbook: {
                select: {
                  businessId: true,
                },
              },
            },
          },
          posts: {
            where: { status: 'posted' },
            orderBy: { postedAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      })

      if (content) {
        contentId = content.id
        campaignId = content.campaignId
        businessId = content.campaign.playbook.businessId
        if (content.posts.length > 0) {
          postId = content.posts[0].id
        }
      }
    }

    // Try campaignSlug (from Clerk/Stripe integration) or utm_campaign to find campaign
    const slugToSearch = campaignSlug || utmCampaign
    if (!businessId && slugToSearch) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          name: { contains: slugToSearch, mode: 'insensitive' },
        },
        select: {
          id: true,
          playbook: { select: { businessId: true } },
        },
      })
      if (campaign) {
        campaignId = campaign.id
        businessId = campaign.playbook.businessId
      }
    }

    // If still no business, try matching by source for known integrations
    // (e.g., "clerk" or "stripe" source from a specific marketing site)
    if (!businessId && source) {
      // Try to find business by website URL pattern
      const siteHints: Record<string, string> = {
        // If the source contains a domain hint, use it
      }
      const hint = siteHints[source]
      if (hint) {
        const biz = await prisma.business.findFirst({
          where: { websiteUrl: { contains: hint, mode: 'insensitive' } },
          select: { id: true },
        })
        if (biz) businessId = biz.id
      }
    }

    // We need a business ID to create the conversion
    if (!businessId) {
      // Try to find any business as a fallback
      const firstBusiness = await prisma.business.findFirst({
        select: { id: true },
      })
      if (!firstBusiness) {
        return errorResponse('No business found to record conversion against', 400)
      }
      businessId = firstBusiness.id
    }

    const conversion = await prisma.conversion.create({
      data: {
        businessId,
        postId: postId || null,
        contentId: contentId || null,
        campaignId: campaignId || null,
        type: type as 'click' | 'signup' | 'trial' | 'purchase',
        value: value !== undefined && !isNaN(value) ? value : null,
        utmSource: utmSource || null,
        utmMedium: utmMedium || null,
        utmCampaign: utmCampaign || null,
        utmContent: utmContent || null,
        sessionId: sessionId || null,
        userAgent: userAgent || null,
        ipAddress: ipAddress || null,
        geoMarket: geoMarket || null,
      },
    })

    return successResponse({
      id: conversion.id,
      type: conversion.type,
      source: source || 'utm',
      campaignId: campaignId || null,
      currency: currency || null,
    }, 200)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to record conversion')
  }
}
