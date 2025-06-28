import { rateLimit } from '../lib/rate-limit'

// テスト用のモックリクエスト作成関数
const createMockRequest = (options: {
  ip?: string
  userAgent?: string
  contentType?: string
  referrer?: string
  host?: string
  method?: string
  body?: any
} = {}) => {
  const headers = new Map()
  
  if (options.ip) {
    headers.set('x-forwarded-for', options.ip)
  }
  if (options.userAgent) {
    headers.set('user-agent', options.userAgent)
  }
  if (options.contentType) {
    headers.set('content-type', options.contentType)
  }
  if (options.referrer) {
    headers.set('referer', options.referrer)
  }
  if (options.host) {
    headers.set('host', options.host)
  }

  return {
    headers: {
      get: (key: string) => headers.get(key.toLowerCase()) || null
    },
    method: options.method || 'POST',
    json: async () => options.body || {}
  } as any
}

describe('Rate Limiting', () => {
  // テスト用の設定
  const testConfig = {
    maxRequests: 3,
    windowMs: 1000 // 1秒
  }

  let limiter: ReturnType<typeof rateLimit>

  beforeEach(() => {
    // 各テストで新しいlimiterインスタンスを作成
    limiter = rateLimit(testConfig)
  })

  describe('あるべき挙動', () => {
    test('制限内のリクエストは許可される', () => {
      const request = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'test-browser' 
      })

      // 1回目のリクエスト
      const result1 = limiter.check(request)
      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)

      // 2回目のリクエスト
      const result2 = limiter.check(request)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(1)

      // 3回目のリクエスト
      const result3 = limiter.check(request)
      expect(result3.allowed).toBe(true)
      expect(result3.remaining).toBe(0)
    })

    test('制限を超えたリクエストは拒否される', () => {
      const request = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'test-browser' 
      })

      // 制限まで使い切る
      for (let i = 0; i < testConfig.maxRequests; i++) {
        limiter.check(request)
      }

      // 制限を超えるリクエスト
      const result = limiter.check(request)
      expect(result.allowed).toBe(false)
      expect(result.remaining).toBe(0)
      expect(result.resetTime).toBeDefined()
    })

    test('異なるクライアントは独立して制限される', () => {
      const request1 = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'test-browser-1' 
      })
      const request2 = createMockRequest({ 
        ip: '192.168.1.2', 
        userAgent: 'test-browser-2' 
      })

      // クライアント1が制限まで使用
      for (let i = 0; i < testConfig.maxRequests; i++) {
        limiter.check(request1)
      }

      // クライアント1は制限される
      const result1 = limiter.check(request1)
      expect(result1.allowed).toBe(false)

      // クライアント2は制限されない
      const result2 = limiter.check(request2)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(2)
    })

    test('時間窓がリセットされると制限も解除される', async () => {
      const request = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'test-browser' 
      })

      // 制限まで使い切る
      for (let i = 0; i < testConfig.maxRequests; i++) {
        limiter.check(request)
      }

      // 制限を超えるリクエストは拒否される
      expect(limiter.check(request).allowed).toBe(false)

      // 時間を進める（実際のテストでは待機時間を短くする）
      await new Promise(resolve => setTimeout(resolve, testConfig.windowMs + 100))

      // 時間窓がリセットされて再度許可される
      const result = limiter.check(request)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })

    test('同じIPでも異なるUser-Agentは別クライアントとして扱われる', () => {
      const request1 = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'browser-1' 
      })
      const request2 = createMockRequest({ 
        ip: '192.168.1.1', 
        userAgent: 'browser-2' 
      })

      // 同じIPでも異なるUser-Agentは独立
      const result1 = limiter.check(request1)
      const result2 = limiter.check(request2)

      expect(result1.allowed).toBe(true)
      expect(result1.remaining).toBe(2)
      expect(result2.allowed).toBe(true)
      expect(result2.remaining).toBe(2)
    })

    test('不明なIPやUser-Agentでも正常に動作する', () => {
      const request = createMockRequest({}) // IP, User-Agent共に未設定

      const result = limiter.check(request)
      expect(result.allowed).toBe(true)
      expect(result.remaining).toBe(2)
    })
  })

  describe('エッジケース', () => {
    test('非常に短い時間窓でも正常に動作する', () => {
      const shortLimiter = rateLimit({ maxRequests: 1, windowMs: 1 })
      const request = createMockRequest({ ip: '192.168.1.1' })

      const result1 = shortLimiter.check(request)
      expect(result1.allowed).toBe(true)

      const result2 = shortLimiter.check(request)
      expect(result2.allowed).toBe(false)
    })

    test('maxRequests=0の場合はすべて拒否される', () => {
      const strictLimiter = rateLimit({ maxRequests: 0, windowMs: 1000 })
      const request = createMockRequest({ ip: '192.168.1.1' })

      const result = strictLimiter.check(request)
      expect(result.allowed).toBe(false)
    })
  })
})
