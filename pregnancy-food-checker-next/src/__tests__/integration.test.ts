/**
 * 統合テスト：アプリケーション全体の動作を検証
 * フロントエンド→API→セキュリティ→Gemini API の流れをテスト
 */

import { NextRequest } from 'next/server'
import { POST } from '../app/api/analyze/route'

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

// Gemini APIをモック
const mockFetch = jest.fn()
global.fetch = mockFetch

describe('Integration Tests', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    // 環境変数の設定
    ;(process.env as any).GEMINI_API_KEY = 'test-api-key'
    ;(process.env as any).NODE_ENV = 'test'
  })

  afterEach(() => {
    // テスト後のクリーンアップ
    delete (process.env as any).GEMINI_API_KEY
    ;(process.env as any).NODE_ENV = 'test'
  })

  describe('エンドツーエンドシナリオ', () => {
    test('正常な画像アップロード→分析→安全な結果の返却', async () => {
      // Gemini APIのモックレスポンス（安全な食品）
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  foods: [
                    { name: '白米', risk: false, details: '' },
                    { name: '焼き魚', risk: false, details: '' },
                    { name: '野菜サラダ', risk: false, details: '' }
                  ]
                })
              }]
            }
          }]
        })
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      const data = await response.json()

      // レスポンス検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(true)
      expect(data.result.message).toContain('リスクが低そうです')
      expect(data.result.detected_food).toEqual([])

      // Gemini APIが適切に呼び出されたことを確認
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('generativelanguage.googleapis.com'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('妊婦がとる食事の画像を元に')
        })
      )
    })

    test('リスクのある食品の検出→適切な警告の返却', async () => {
      // Gemini APIのモックレスポンス（リスクのある食品）
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  foods: [
                    { name: '生ハム', risk: true, details: 'リステリア菌の感染リスクがあります' },
                    { name: '生卵', risk: true, details: 'サルモネラ菌のリスクがあります' },
                    { name: 'パン', risk: false, details: '' }
                  ]
                })
              }]
            }
          }]
        })
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      const data = await response.json()

      // レスポンス検証
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(false)
      expect(data.result.message).toContain('リスクがある食品が含まれている')
      expect(data.result.detected_food).toContain('生ハム')
      expect(data.result.detected_food).toContain('生卵')
      expect(data.result.detected_food).not.toContain('パン')
      expect(data.result.details).toContain('リステリア菌')
      expect(data.result.details).toContain('サルモネラ菌')
    })

    test('セキュリティ制限の統合的な動作確認', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      // 1. ボットからのアクセス
      const botRequest = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Googlebot/2.1',
        ip: '192.168.1.1'
      })

      const botResponse = await POST(botRequest)
      expect(botResponse.status).toBe(403)

      // 2. 不正なContent-Type
      const invalidContentTypeRequest = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'text/plain',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const invalidContentResponse = await POST(invalidContentTypeRequest)
      expect(invalidContentResponse.status).toBe(400)

      // 3. 不正な画像データ
      const invalidImageRequest = createMockRequest({
        method: 'POST',
        body: { image: 'data:text/plain;base64,invaliddata' },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const invalidImageResponse = await POST(invalidImageRequest)
      expect(invalidImageResponse.status).toBe(400)
    })

    test('レート制限の統合的な動作確認', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  foods: [{ name: 'テスト', risk: false, details: '' }]
                })
              }]
            }
          }]
        })
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      // 同一クライアントから連続してリクエスト
      const baseRequest = {
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'test-user-agent',
        ip: '192.168.1.100'
      }

      // 最初の10回は成功するはず（設定: 1時間に10回）
      for (let i = 0; i < 10; i++) {
        const request = createMockRequest(baseRequest)
        const response = await POST(request)
        expect(response.status).toBe(200)
      }

      // 11回目はレート制限に引っかかる
      const rateLimitedRequest = createMockRequest(baseRequest)
      const rateLimitedResponse = await POST(rateLimitedRequest)
      expect(rateLimitedResponse.status).toBe(429)

      const errorData = await rateLimitedResponse.json()
      expect(errorData.error).toContain('リクエスト制限に達しました')
    })

    test('Gemini API障害時のフォールバック動作', async () => {
      // Gemini APIが503エラーを返す
      mockFetch.mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => 'Service Unavailable'
      })

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      const data = await response.json()

      // APIは成功レスポンスを返すが、内容はエラーメッセージ
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(false)
      expect(data.result.message).toContain('一時的にGeminiが使用できません')

      // リトライが行われたことを確認（最大3回）
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    test('プロンプトインジェクション攻撃の防御', async () => {
      // 悪意のある画像データ（実際は有効なBase64だが、攻撃を模倣）
      const maliciousImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      // Gemini APIレスポンスに悪意のあるコンテンツを含める
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  foods: [
                    { 
                      name: '<script>alert("XSS")</script>悪意のある食品', 
                      risk: true, 
                      details: 'javascript:alert("XSS")リスク説明' 
                    }
                  ]
                })
              }]
            }
          }]
        })
      })

      const request = createMockRequest({
        method: 'POST',
        body: { image: maliciousImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      const data = await response.json()

      // レスポンスは成功するが、危険なコンテンツはサニタイズされている
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(false)
      
      // HTMLタグやJavaScriptコードが除去されていることを確認
      expect(data.result.detected_food[0]).not.toContain('<script>')
      expect(data.result.detected_food[0]).not.toContain('</script>')
      expect(data.result.details).not.toContain('javascript:')
      expect(data.result.details).not.toContain('alert')
    })

    test('長時間実行される分析処理のテスト', async () => {
      // 長時間のレスポンスをシミュレート
      let resolveResponse: (value: any) => void
      const delayedPromise = new Promise(resolve => {
        resolveResponse = resolve
      })

      mockFetch.mockReturnValue(delayedPromise)

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      // 非同期でAPIを呼び出し
      const responsePromise = POST(request)

      // 少し待ってからレスポンスを解決
      setTimeout(() => {
        resolveResponse!({
          ok: true,
          json: async () => ({
            candidates: [{
              content: {
                parts: [{
                  text: JSON.stringify({
                    foods: [{ name: 'テスト食品', risk: false, details: '' }]
                  })
                }]
              }
            }]
          })
        })
      }, 100)

      const response = await responsePromise
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.result.safe).toBe(true)
    })
  })

  describe('環境設定による動作変化', () => {
    test('本番環境でのReferrerチェック', async () => {
      ;(process.env as any).NODE_ENV = 'production'

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      // 不正なReferrerでリクエスト
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        referrer: 'https://malicious-site.com/',
        host: 'legitimate-site.com',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      expect(response.status).toBe(403)

      const data = await response.json()
      expect(data.error).toBe('アクセス元が不正です')
    })

    test('API キー未設定時の動作', async () => {
      delete process.env.GEMINI_API_KEY

      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg=='
      
      const request = createMockRequest({
        method: 'POST',
        body: { image: validImageData },
        contentType: 'application/json',
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        ip: '192.168.1.1'
      })

      const response = await POST(request)
      expect(response.status).toBe(500)

      const data = await response.json()
      expect(data.error).toBe('Gemini APIキーが設定されていません')
    })
  })
})
