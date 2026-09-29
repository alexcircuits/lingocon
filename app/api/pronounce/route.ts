/**
 * IPA Pronunciation API Route
 * 
 * This endpoint accepts IPA strings and synthesizes audio using AWS Polly.
 * 
 * SETUP INSTRUCTIONS:
 * 
 * To enable IPA pronunciation, configure AWS credentials:
 * 
 * 1. Install AWS SDK: npm install @aws-sdk/client-polly (already installed)
 * 2. Set environment variables in your .env file:
 *    - AWS_REGION (e.g., "us-east-1", optional, defaults to "us-east-1")
 *    - AWS_ACCESS_KEY_ID (required)
 *    - AWS_SECRET_ACCESS_KEY (required)
 *    - AWS_POLLY_VOICE_ID (optional, defaults to "Joanna")
 * 
 * 3. Restart your Next.js dev server after adding environment variables
 * 
 * SECURITY / COST:
 * - Rate limited per client IP (from X-Real-IP / the proxy-appended X-Forwarded-For hop — the
 *   first XFF entry is client-controlled) plus a per-instance global ceiling, since every call is
 *   a paid Polly request and the route is public (anonymous readers use it).
 * - Input length capped; voices restricted to the settings allow-list; SSML-escaped.
 * - AWS credentials are server-side only; AWS error details are logged, not returned.
 */

import { NextRequest, NextResponse } from "next/server"
import { rateLimit } from "@/lib/rate-limit"
import { DEFAULT_TTS_VOICE, isAllowedTtsVoice, normalizeIpaForPolly } from "@/lib/constants/tts"

const MAX_IPA_LENGTH = 200

function getClientIP(request: NextRequest): string {
  // nginx sets X-Real-IP from $remote_addr; with only X-Forwarded-For, trust the hop the proxy
  // appended (the last one), never the client-supplied first entry.
  const realIP = request.headers.get("x-real-ip")
  if (realIP) return realIP.trim()
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) return forwarded.split(",").at(-1)!.trim()
  return "unknown"
}

function checkRateLimit(ip: string): boolean {
  // Global ceiling first so a spread of IPs cannot run up an unbounded Polly bill.
  return rateLimit("pronounce:global", 600, 60_000).ok && rateLimit(`pronounce:${ip}`, 30, 60_000).ok
}

// Validate IPA string - basic validation
function validateIPA(ipa: string): { valid: boolean; warning?: string } {
  if (!ipa || typeof ipa !== "string" || ipa.trim().length === 0) {
    return { valid: false }
  }

  // Remove slashes if present
  const cleaned = ipa.replace(/^\/|\/$/g, "").trim()

  if (cleaned.length === 0 || cleaned.length > MAX_IPA_LENGTH) {
    return { valid: false }
  }

  // Check for unusual characters (non-IPA symbols)
  // This is a basic check - IPA can contain many Unicode characters
  // We'll allow most Unicode characters but warn about obviously non-IPA
  const suspiciousPattern = /[<>{}[\]\\|]/g
  if (suspiciousPattern.test(cleaned)) {
    return { valid: true, warning: "IPA contains unusual symbols" }
  }

  return { valid: true }
}

// IPA Reader service integration
// This uses ipa-reader.com's approach via a proxy
// Note: ipa-reader.com may not have a public API, so this is a placeholder
// that can be adapted to use AWS Polly or another service
// Escape XML/SSML special characters to prevent injection
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

const ALLOWED_SPEEDS = ["x-slow", "slow", "medium", "fast", "x-fast"]
const SPEED_PERCENTAGE_REGEX = /^\d{1,3}%$/

async function synthesizeIPA(ipa: string, speed: string = "slow", voiceId?: string): Promise<{ audioUrl?: string; error?: string }> {
  try {
    // Remove slashes if present
    const cleanedIPA = normalizeIpaForPolly(ipa.replace(/^\/|\/$/g, "").trim())

    // Validate speed parameter
    const safeSpeed = ALLOWED_SPEEDS.includes(speed) ? speed : 
      SPEED_PERCENTAGE_REGEX.test(speed) ? speed : "slow"

    // Check if AWS credentials are configured
    if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
      return {
        error: "AWS credentials not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.",
      }
    }

    // Use AWS Polly for IPA synthesis
    const { PollyClient, SynthesizeSpeechCommand } = await import("@aws-sdk/client-polly")
    const pollyClient = new PollyClient({
      region: process.env.AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    })

    // Escape IPA to prevent SSML injection
    const escapedIPA = escapeXml(cleanedIPA)
    const ssmlText = `<speak><prosody rate="${safeSpeed}"><phoneme alphabet="ipa" ph="${escapedIPA}">${escapedIPA}</phoneme></prosody></speak>`
    const command = new SynthesizeSpeechCommand({
      Text: ssmlText,
      TextType: "ssml",
      VoiceId: (isAllowedTtsVoice(voiceId) ? voiceId : process.env.AWS_POLLY_VOICE_ID || DEFAULT_TTS_VOICE) as any,
      OutputFormat: "mp3",
    })

    const { AudioStream } = await pollyClient.send(command)

    if (!AudioStream) {
      return { error: "Audio stream not available" }
    }

    // Convert stream to buffer
    const chunks: Uint8Array[] = []
    // Cast to any to assume async iterable behavior in Node.js environment
    // OR use the SDK's built-in conversion if available, but casting is safer for immediate build fix
    for await (const chunk of (AudioStream as any)) {
      chunks.push(chunk)
    }
    const buffer = Buffer.concat(chunks)
    const base64 = buffer.toString("base64")
    const audioUrl = `data:audio/mp3;base64,${base64}`

    return { audioUrl }
  } catch (error) {
    console.error("Error synthesizing IPA:", error)
    return { error: "Failed to generate pronunciation audio" }
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check rate limit
    const clientIP = getClientIP(request)
    if (!checkRateLimit(clientIP)) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please wait before trying again." },
        { status: 429 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { ipa, speed = "slow", voiceId } = body ?? {}

    // Validate input
    if (typeof ipa !== "string" || !ipa) {
      return NextResponse.json(
        { error: "IPA string is required" },
        { status: 400 }
      )
    }

    // Validate IPA format
    const validation = validateIPA(ipa)
    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid IPA string" },
        { status: 400 }
      )
    }

    // Sanitize input
    let sanitizedIPA = ipa.replace(/[<>{}[\]\\|]/g, "").trim()

    // Improve audibility for short/consonantal IPA by padding with schwa if needed
    // Only if it's a single or very short IPA string that might be just a consonant
    if (sanitizedIPA.length <= 2 && !/[aeiouyøæɑɔɛɪʊə]/.test(sanitizedIPA)) {
      sanitizedIPA = `ə${sanitizedIPA}ə`
    }

    // Synthesize audio
    const result = await synthesizeIPA(sanitizedIPA, typeof speed === "string" ? speed : "slow", voiceId)

    if (result.error) {
      return NextResponse.json(
        {
          error: result.error,
          warning: validation.warning,
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      audioUrl: result.audioUrl,
      warning: validation.warning,
    })
  } catch (error) {
    console.error("Error in /api/pronounce:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
      },
      { status: 500 }
    )
  }
}

// Only allow POST requests
export async function GET() {
  return NextResponse.json(
    { error: "Method not allowed. Use POST." },
    { status: 405 }
  )
}

