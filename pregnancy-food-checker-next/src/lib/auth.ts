import { NextRequest } from 'next/server'

/**
 * Basic Authentication による簡易アクセス制御
 */
export function validateBasicAuth(request: NextRequest): { isValid: boolean; error?: string } {
  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return { isValid: false, error: '認証が必要です' }
  }

  try {
    const base64Credentials = authHeader.slice(6)
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8')
    const [username, password] = credentials.split(':')

    // 環境変数から認証情報を取得
    const validUsername = process.env.API_USERNAME
    const validPassword = process.env.API_PASSWORD

    if (!validUsername || !validPassword) {
      return { isValid: false, error: 'API認証が設定されていません' }
    }

    if (username === validUsername && password === validPassword) {
      return { isValid: true }
    }

    return { isValid: false, error: '認証に失敗しました' }
  } catch {
    return { isValid: false, error: '認証情報が不正です' }
  }
}

/**
 * Referrer チェック（簡易的なCSRF対策）
 */
export function validateReferrer(request: NextRequest): { isValid: boolean; error?: string } {
  const referrer = request.headers.get('referer')
  const host = request.headers.get('host')
  
  if (!referrer) {
    return { isValid: false, error: 'Referrerが設定されていません' }
  }

  try {
    const referrerUrl = new URL(referrer)
    const expectedOrigin = `https://${host}`
    
    if (referrerUrl.origin !== expectedOrigin) {
      return { isValid: false, error: '不正なReferrer' }
    }

    return { isValid: true }
  } catch {
    return { isValid: false, error: 'Referrerが不正です' }
  }
}

/**
 * Content-Type チェック
 */
export function validateContentType(request: NextRequest): { isValid: boolean; error?: string } {
  const contentType = request.headers.get('content-type')
  
  if (!contentType || !contentType.includes('application/json')) {
    return { isValid: false, error: '不正なContent-Type' }
  }

  return { isValid: true }
}

/**
 * User-Agent チェック（ボット検出）
 */
export function validateUserAgent(request: NextRequest): { isValid: boolean; error?: string } {
  const userAgent = request.headers.get('user-agent')
  
  if (!userAgent) {
    return { isValid: false, error: 'User-Agentが設定されていません' }
  }

  // 一般的なボットやスクリプトを検出
  const botPatterns = [
    /bot/i,
    /crawler/i,
    /spider/i,
    /scraper/i,
    /curl/i,
    /wget/i,
    /python/i,
    /node/i,
    /facebook/i,
    /twitter/i,
    /linkedin/i,
    /whatsapp/i
  ]

  for (const pattern of botPatterns) {
    if (pattern.test(userAgent)) {
      return { isValid: false, error: 'ボットからのアクセスは禁止されています' }
    }
  }

  return { isValid: true }
}
