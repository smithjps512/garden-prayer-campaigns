import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import bcrypt from 'bcryptjs'
import prisma from './prisma'

const SECRET_KEY = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'development-secret-key-must-be-at-least-32-chars'
)

const COOKIE_NAME = 'campaign-engine-session'

export interface SessionPayload {
  userId: string
  email: string
  exp: number
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword)
}

export async function createSession(userId: string, email: string): Promise<string> {
  const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7 // 7 days

  const token = await new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(SECRET_KEY)

  return token
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET_KEY)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value

  if (!token) return null

  return verifySession(token)
}

export async function setSessionCookie(token: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function authenticateUser(email: string, password: string) {
  const user = await prisma.user.findUnique({
    where: { email },
  })

  if (!user) return null

  const isValid = await verifyPassword(password, user.passwordHash)
  if (!isValid) return null

  return user
}

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await hashPassword(password)

  return prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
    },
  })
}

export async function ensureAuthenticated(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session) {
    throw new Error('Unauthorized')
  }
  return session
}
