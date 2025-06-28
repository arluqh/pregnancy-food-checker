import { NextRequest } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// インメモリストレージ（本番環境ではRedisやDynamoDB等を推奨）
const rateLimitStore = new Map<string, RateLimitEntry>()

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

export function rateLimit(config: RateLimitConfig) {
  return {
    check: (request: NextRequest) => {
      const clientId = getClientId(request)
      const now = Date.now()
      const windowStart = now - config.windowMs
      
      // 古いエントリを削除
      cleanupExpiredEntries(windowStart)
      
      const entry = rateLimitStore.get(clientId)
      
      if (!entry) {
        // maxRequests=0の場合は全て拒否
        if (config.maxRequests === 0) {
          return { allowed: false, remaining: 0 }
        }
        
        // 新規クライアント
        rateLimitStore.set(clientId, {
          count: 1,
          resetTime: now + config.windowMs
        })
        return { allowed: true, remaining: config.maxRequests - 1 }
      }
      
      if (now > entry.resetTime) {
        // maxRequests=0の場合は全て拒否
        if (config.maxRequests === 0) {
          return { allowed: false, remaining: 0 }
        }
        
        // ウィンドウリセット
        rateLimitStore.set(clientId, {
          count: 1,
          resetTime: now + config.windowMs
        })
        return { allowed: true, remaining: config.maxRequests - 1 }
      }
      
      if (entry.count >= config.maxRequests) {
        // 制限超過
        return { 
          allowed: false, 
          remaining: 0,
          resetTime: entry.resetTime
        }
      }
      
      // カウンターを増加
      entry.count++
      rateLimitStore.set(clientId, entry)
      
      return { 
        allowed: true, 
        remaining: config.maxRequests - entry.count 
      }
    }
  }
}

function getClientId(request: NextRequest): string {
  // IPアドレスとUser-Agentを組み合わせてクライアントを識別
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  const userAgent = request.headers.get('user-agent') || 'unknown'
  
  // ハッシュ化して匿名化
  return btoa(`${ip}-${userAgent}`).slice(0, 32)
}

function cleanupExpiredEntries(windowStart: number) {
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < windowStart) {
      rateLimitStore.delete(key)
    }
  }
}
