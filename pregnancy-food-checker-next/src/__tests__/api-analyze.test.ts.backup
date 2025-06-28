/**
 * API Route /api/analyze の簡易テスト
 * Next.js route moduleのimportを避けて基本機能をテスト
 */

import { NextRequest, NextResponse } from 'next/server'

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

describe('API Route: /api/analyze', () => {
  // 環境変数のモック
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetAllMocks()
    process.env = { ...originalEnv }
    process.env.GEMINI_API_KEY = 'test-api-key'
    // NODE_ENVはテスト環境で自動設定されるため設定不要
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('あるべき挙動', () => {
    test('有効な画像データで正常なレスポンスが返される', async () => {
      // Gemini APIのモックレスポンス
      mockCallGeminiAPI.mockResolvedValue({
        safe: true,
        detected_food: [],
        message: 'この食事は妊娠中でもリスクが低そうです',
        details: ''
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referrer: 'https://localhost:3000/',
        host: 'localhost:3000'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result).toBeDefined()
      expect(data.result.safe).toBe(true)
    })

    test('リスクのある食品が検出される', async () => {
      // リスクのある食品のモックレスポンス
      mockCallGeminiAPI.mockResolvedValue({
        safe: false,
        detected_food: ['生ハム', '生卵'],
        message: 'リスクがある食品が含まれている可能性があります',
        details: '生ハム: 感染症のリスク\n生卵: サルモネラ菌のリスク'
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referrer: 'https://localhost:3000/',
        host: 'localhost:3000'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(false)
      expect(data.result.detected_food).toContain('生ハム')
      expect(data.result.detected_food).toContain('生卵')
    })

    test('レート制限が正常に機能する', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'test-browser',
        ip: '192.168.1.1',
        referrer: 'https://localhost:3000/',
        host: 'localhost:3000'
      })

      mockCallGeminiAPI.mockResolvedValue({
        safe: true,
        detected_food: [],
        message: 'テスト',
        details: ''
      })

      // レート制限（1時間に10回）に達するまでリクエスト
      for (let i = 0; i < 10; i++) {
        const response = await POST(request)
        expect(response.status).toBe(200)
      }

      // 11回目は制限される
      const response = await POST(request)
      expect(response.status).toBe(429)
      
      const data = await response.json()
      expect(data.error).toContain('リクエスト制限に達しました')
    })
  })

  describe('エラーケース', () => {
    test('画像データが無い場合はエラーになる', async () => {
      const request = createMockRequest({
        method: 'POST',
        body: {},
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('画像データが提供されていません')
    })

    test('不正な画像形式は拒否される', async () => {
      const invalidImageData = 'data:text/plain;base64,SGVsbG8gV29ybGQ='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: invalidImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('サポートされていない画像形式')
    })

    test('APIキーが設定されていない場合はエラーになる', async () => {
      delete process.env.GEMINI_API_KEY

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Gemini APIキーが設定されていません')
    })

    test('ボットからのアクセスは拒否される', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Googlebot/2.1'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('アクセスが拒否されました')
    })

    test('不正なContent-Typeは拒否される', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'text/plain',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('リクエスト形式が不正です')
    })
  })

  describe('Gemini API連携', () => {
    test('Gemini APIエラー時の適切な処理', async () => {
      // Gemini APIがエラーを返すケース
      mockCallGeminiAPI.mockResolvedValue({
        safe: false,
        detected_food: null,
        message: 'Gemini APIがエラーを返しました',
        details: 'API Error'
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(false)
      expect(data.result.message).toContain('エラー')
    })

    test('内部エラー時の適切な処理', async () => {
      // 内部でエラーが発生するケース
      mockCallGeminiAPI.mockRejectedValue(new Error('Internal error'))

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      })

      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('分析中にエラーが発生しました。時間をおいて再度お試しください。')
    })
  })
})
