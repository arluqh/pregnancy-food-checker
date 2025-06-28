import { sanitizeAndValidatePrompt, validateApiResponse } from '../lib/security'

// テスト用データ作成関数
const createValidImageData = () => {
  // 1x1 PNG画像のBase64データ
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu/CJKQAAAABJRU5ErkJggg=='
  return `data:image/png;base64,${base64Data}`
}

const createInvalidImageData = () => {
  return 'data:text/plain;base64,SGVsbG8gV29ybGQ='
}

describe('Security Functions', () => {
  describe('sanitizeAndValidatePrompt', () => {
    describe('あるべき挙動', () => {
      test('有効な画像データは受け入れられる', () => {
        const validImageData = createValidImageData()
        
        const result = sanitizeAndValidatePrompt(validImageData)
        
        expect(result.isSafe).toBe(true)
        expect(result.sanitizedPrompt).toBeDefined()
        expect(result.sanitizedPrompt).toContain('妊婦がとる食事の画像を元に')
        expect(result.sanitizedPrompt).toContain('JSON形式で返してください')
      })

      test('サポートされている画像形式は受け入れられる', () => {
        const supportedFormats = ['jpeg', 'jpg', 'png', 'webp']
        
        supportedFormats.forEach(format => {
          const imageData = `data:image/${format};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu+CJKQAAAABJRU5ErkJggg==`
          const result = sanitizeAndValidatePrompt(imageData)
          
          expect(result.isSafe).toBe(true)
        })
      })

      test('不正な画像形式は拒否される', () => {
        const invalidFormats = ['gif', 'svg', 'bmp', 'tiff']
        
        invalidFormats.forEach(format => {
          const imageData = `data:image/${format};base64,validbase64data`
          const result = sanitizeAndValidatePrompt(imageData)
          
          expect(result.isSafe).toBe(false)
          expect(result.reason).toBe('サポートされていない画像形式')
        })
      })

      test('非画像データは拒否される', () => {
        const invalidData = createInvalidImageData()
        
        const result = sanitizeAndValidatePrompt(invalidData)
        
        expect(result.isSafe).toBe(false)
        expect(result.reason).toBe('サポートされていない画像形式')
      })

      test('空のデータは拒否される', () => {
        const result1 = sanitizeAndValidatePrompt('')
        const result2 = sanitizeAndValidatePrompt(null as any)
        const result3 = sanitizeAndValidatePrompt(undefined as any)
        
        expect(result1.isSafe).toBe(false)
        expect(result2.isSafe).toBe(false)
        expect(result3.isSafe).toBe(false)
      })

      test('data URL形式でないデータは拒否される', () => {
        const invalidData = 'not-a-data-url'
        
        const result = sanitizeAndValidatePrompt(invalidData)
        
        expect(result.isSafe).toBe(false)
        expect(result.reason).toBe('無効な画像形式')
      })

      test('大きすぎる画像は拒否される', () => {
        const largeData = 'data:image/png;base64,' + 'A'.repeat(11 * 1024 * 1024) // 11MB
        
        const result = sanitizeAndValidatePrompt(largeData)
        
        expect(result.isSafe).toBe(false)
        expect(result.reason).toBe('画像サイズが大きすぎます')
      })

      test('不正なBase64データは拒否される', () => {
        const invalidBase64 = 'data:image/png;base64,invalid@base64#data!'
        
        const result = sanitizeAndValidatePrompt(invalidBase64)
        
        expect(result.isSafe).toBe(false)
        expect(result.reason).toBe('不正なBase64エンコーディング')
      })

      test('不完全なdata URLは拒否される', () => {
        const incompleteData = 'data:image/png;base64,'
        
        const result = sanitizeAndValidatePrompt(incompleteData)
        
        expect(result.isSafe).toBe(false)
        expect(result.reason).toBe('不正な画像データ形式')
      })
    })
  })

  describe('validateApiResponse', () => {
    describe('あるべき挙動', () => {
      test('正常なJSONレスポンスは受け入れられる', () => {
        const validResponse = JSON.stringify({
          foods: [
            { name: '寿司', risk: true, details: '生魚のリスク' },
            { name: 'サラダ', risk: false, details: '' }
          ]
        })
        
        const result = validateApiResponse(validResponse)
        
        expect(result.isValid).toBe(true)
        expect(result.sanitizedResponse).toBeDefined()
        expect(result.sanitizedResponse!.foods).toHaveLength(2)
        expect(result.sanitizedResponse!.foods[0].name).toBe('寿司')
        expect(result.sanitizedResponse!.foods[0].risk).toBe(true)
      })

      test('レスポンスからJSON部分のみを抽出できる', () => {
        const responseWithExtra = `
        ここは説明文です。
        
        {
          "foods": [
            {"name": "チーズ", "risk": false, "details": ""}
          ]
        }
        
        追加の説明文
        `
        
        const result = validateApiResponse(responseWithExtra)
        
        expect(result.isValid).toBe(true)
        expect(result.sanitizedResponse!.foods).toHaveLength(1)
        expect(result.sanitizedResponse!.foods[0].name).toBe('チーズ')
      })

      test('不正な構造のJSONは拒否される', () => {
        const invalidStructure = JSON.stringify({
          wrongField: 'value'
        })
        
        const result = validateApiResponse(invalidStructure)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('無効なレスポンス構造')
      })

      test('JSONが含まれていないレスポンスは拒否される', () => {
        const noJsonResponse = 'これはただのテキストです'
        
        const result = validateApiResponse(noJsonResponse)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('JSON形式のレスポンスが見つかりません')
      })

      test('不正なJSONは拒否される', () => {
        // JSON形式として認識できるが、パースに失敗するケース
        const invalidJson = '{ "foods": [{ "name": "test", }] }' // 末尾カンマで不正
        
        const result = validateApiResponse(invalidJson)
        
        expect(result.isValid).toBe(false)
        expect(result.error).toBe('JSONパースエラー')
      })

      test('テキストがサニタイズされる', () => {
        const responseWithHtml = JSON.stringify({
          foods: [
            { 
              name: '<script>alert("xss")</script>寿司', 
              risk: true, 
              details: 'リスク<>&"\'説明' 
            }
          ]
        })
        
        const result = validateApiResponse(responseWithHtml)
        
        expect(result.isValid).toBe(true)
        expect(result.sanitizedResponse!.foods[0].name).toBe('scriptalert(xss)/script寿司')
        expect(result.sanitizedResponse!.foods[0].details).toBe('リスク説明')
      })

      test('長すぎるテキストは切り詰められる', () => {
        const longText = 'A'.repeat(600)
        const responseWithLongText = JSON.stringify({
          foods: [
            { name: longText, risk: false, details: longText }
          ]
        })
        
        const result = validateApiResponse(responseWithLongText)
        
        expect(result.isValid).toBe(true)
        expect(result.sanitizedResponse!.foods[0].name).toHaveLength(500)
        expect(result.sanitizedResponse!.foods[0].details).toHaveLength(500)
      })

      test('不正な食品項目は除外される', () => {
        const responseWithInvalidItems = JSON.stringify({
          foods: [
            { name: '有効な食品', risk: true, details: 'テスト' },
            { risk: true, details: 'nameが無い' }, // nameフィールドが無い
            null, // null値
            'string', // 文字列
            { name: '有効な食品2', risk: false, details: '' }
          ]
        })
        
        const result = validateApiResponse(responseWithInvalidItems)
        
        expect(result.isValid).toBe(true)
        expect(result.sanitizedResponse!.foods).toHaveLength(2)
        expect(result.sanitizedResponse!.foods[0].name).toBe('有効な食品')
        expect(result.sanitizedResponse!.foods[1].name).toBe('有効な食品2')
      })
    })
  })
})
