import { validateReferrer, validateContentType, validateUserAgent } from '../lib/auth'
import { createMockRequest } from './setup'

describe('Access Control', () => {
  describe('validateReferrer', () => {
    describe('あるべき挙動', () => {
      test('同一ドメインからのリクエストは許可される', () => {
        const request = createMockRequest({
          referrer: 'https://example.com/page',
          host: 'example.com'
        })
        
        const result = validateReferrer(request)
        
        expect(result.isValid).toBe(true)
      })

      test('異なるドメインからのリクエストは拒否される', () => {
        const request = createMockRequest({
          referrer: 'https://malicious.com/page',
          host: 'example.com'
        })
        
        const result = validateReferrer(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('不正なReferrer')
      })

      test('Referrerが無いリクエストは拒否される', () => {
        const request = createMockRequest({
          host: 'example.com'
        })
        
        const result = validateReferrer(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Referrerが設定されていません')
      })

      test('不正なReferrer URLは拒否される', () => {
        const request = createMockRequest({
          referrer: 'invalid-url',
          host: 'example.com'
        })
        
        const result = validateReferrer(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('Referrerが不正です')
      })

      test('HTTPSからHTTPSへのリクエストは許可される', () => {
        const request = createMockRequest({
          referrer: 'https://secure.com/app',
          host: 'secure.com'
        })
        
        const result = validateReferrer(request)
        
        expect(result.isValid).toBe(true)
      })
    })
  })

  describe('validateContentType', () => {
    describe('あるべき挙動', () => {
      test('application/jsonは許可される', () => {
        const request = createMockRequest({
          contentType: 'application/json'
        })
        
        const result = validateContentType(request)
        
        expect(result.isValid).toBe(true)
      })

      test('application/json;charset=utf-8は許可される', () => {
        const request = createMockRequest({
          contentType: 'application/json; charset=utf-8'
        })
        
        const result = validateContentType(request)
        
        expect(result.isValid).toBe(true)
      })

      test('text/plainは拒否される', () => {
        const request = createMockRequest({
          contentType: 'text/plain'
        })
        
        const result = validateContentType(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('不正なContent-Type')
      })

      test('Content-Typeが無いリクエストは拒否される', () => {
        const request = createMockRequest({})
        
        const result = validateContentType(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('不正なContent-Type')
      })

      test('multipart/form-dataは拒否される', () => {
        const request = createMockRequest({
          contentType: 'multipart/form-data'
        })
        
        const result = validateContentType(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('不正なContent-Type')
      })
    })
  })

  describe('validateUserAgent', () => {
    describe('あるべき挙動', () => {
      test('通常のブラウザのUser-Agentは許可される', () => {
        const normalUserAgents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15'
        ]
        
        normalUserAgents.forEach(userAgent => {
          const request = createMockRequest({ userAgent })
          const result = validateUserAgent(request)
          
          expect(result.isValid).toBe(true)
        })
      })

      test('ボットのUser-Agentは拒否される', () => {
        const botUserAgents = [
          'Mozilla/5.0 (compatible; Googlebot/2.1)',
          'facebookexternalhit/1.1',
          'Twitterbot/1.0',
          'LinkedInBot/1.0',
          'WhatsApp/2.19.81',
          'crawler-test',
          'spider-bot',
          'scraper-tool'
        ]
        
        botUserAgents.forEach(userAgent => {
          const request = createMockRequest({ userAgent })
          const result = validateUserAgent(request)
          
          expect(result.isValid).toBe(false)
          expect(result.error).toBe('ボットからのアクセスは禁止されています')
        })
      })

      test('スクリプト系のUser-Agentは拒否される', () => {
        const scriptUserAgents = [
          'curl/7.68.0',
          'wget/1.20.3',
          'Python/3.9.1',
          'node.js/14.15.4',
          'Python-urllib/3.9'
        ]
        
        scriptUserAgents.forEach(userAgent => {
          const request = createMockRequest({ userAgent })
          const result = validateUserAgent(request)
          
          expect(result.isValid).toBe(false)
          expect(result.error).toBe('ボットからのアクセスは禁止されています')
        })
      })

      test('User-Agentが無いリクエストは拒否される', () => {
        const request = createMockRequest({})
        
        const result = validateUserAgent(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('User-Agentが設定されていません')
      })

      test('大文字小文字を区別せずにボットを検出する', () => {
        const request = createMockRequest({ userAgent: 'GOOGLEBOT/2.1' })
        
        const result = validateUserAgent(request)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('ボットからのアクセスは禁止されています')
      })
    })
  })
})
