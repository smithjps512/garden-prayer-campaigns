import { NextRequest } from 'next/server'
import prisma from '@/lib/prisma'
import { successResponse, errorResponse, serverErrorResponse } from '@/lib/api'

/**
 * POST /api/webhooks/conversion
 *
 * Receives conversion events from UTM-tagged traffic.
 * Maps UTM params back to Campaign and Content, creates a Conversion record.
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

    // UTM params — at least utm_source is required to map the conversion
    const utmSource = (data.utm_source || data.utmSource) as string | undefined
    const utmMedium = (data.utm_medium || data.utmMedium) as string | undefined
    const utmCampaign = (data.utm_campaign || data.utmCampaign) as string | undefined
    const utmContent = (data.utm_content || data.utmContent) as string | undefined

    if (!utmSource) {
      return errorResponse('Missing utm_source parameter', 400)
    }

    // Optional fields
    const value = data.value !== undefined ? Number(data.value) : undefined
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

    // If we couldn't find a business from content, try to find one from utm_campaign slug
    if (!businessId && utmCampaign) {
      const campaign = await prisma.campaign.findFirst({
        where: {
          name: { contains: utmCampaign, mode: 'insensitive' },
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

    return successResponse({ id: conversion.id, type: conversion.type }, 200)
  } catch (error) {
    return serverErrorResponse(error, 'Failed to record conversion')
  }
}
