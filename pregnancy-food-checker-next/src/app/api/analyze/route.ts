import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { sanitizeAndValidatePrompt, validateApiResponse } from '@/lib/security'
import { validateReferrer, validateContentType, validateUserAgent } from '@/lib/auth'

// Rate limiting設定（1時間に10回まで）
const limiter = rateLimit({
  maxRequests: 10,
  windowMs: 60 * 60 * 1000 // 1時間
})

async function callGeminiAPI(imageData: string, safePrompt: string) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return {
      safe: false,
      detected_food: null,
      message: 'Gemini APIキーが設定されていません',
      details: ''
    }
  }

  const maxRetries = 3
  const baseDelay = 1000 // 1秒

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // 画像データ（data:image/...;base64,....）からbase64部分を抽出
      const [, imageB64] = imageData.split(',')

      // 安全なプロンプトを使用（パラメータとして受け取る）
      const prompt = safePrompt

      const requestBody = {
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: imageB64
                }
              }
            ]
          }
        ]
      }

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody)
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        // const error = JSON.parse(errorText) // エラー詳細は必要に応じて使用
        
        // 503 (サーバー過負荷) の場合はリトライ
        if (response.status === 503 && attempt < maxRetries - 1) {
          const delay = baseDelay * Math.pow(2, attempt) // 指数バックオフ
          console.log(`Gemini API過負荷 (試行 ${attempt + 1}/${maxRetries})。${delay}ms後にリトライします...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      // 成功した場合の処理
      const data = await response.json()
      
      // エラーハンドリングを強化
      if (!data.candidates || data.candidates.length === 0) {
        return {
          safe: false,
          detected_food: null,
          message: 'Geminiからレスポンスが得られませんでした',
          details: JSON.stringify(data)
        }
      }

      const text = data.candidates[0]?.content?.parts?.[0]?.text || ''
      
      if (!text) {
        return {
          safe: false,
          detected_food: null,
          message: 'Geminiからテキストレスポンスが得られませんでした',
          details: JSON.stringify(data.candidates[0])
        }
      }

      // レスポンスの検証とサニタイゼーション
      const validation = validateApiResponse(text)
      if (!validation.isValid || !validation.sanitizedResponse) {
        return {
          safe: false,
          detected_food: null,
          message: 'APIレスポンスの検証に失敗しました',
          details: validation.error || ''
        }
      }

      const foods = validation.sanitizedResponse.foods
      const riskyFoods = foods.filter((f: { name: string; risk: boolean; details: string }) => f.risk === true)
      const safe = riskyFoods.length === 0

      if (safe) {
        return {
          safe: true,
          detected_food: [],
          message: 'この食事は妊娠中でもリスクが低そうです。メニューや原材料を確認し、食事を楽しんでください。',
          details: ''
        }
      } else {
        return {
          safe: false,
          detected_food: riskyFoods.map((f: { name: string; risk: boolean; details: string }) => f.name),
          message: 'リスクがある食品が含まれている可能性があります。詳細をご確認ください。',
          details: riskyFoods.map((f: { name: string; risk: boolean; details: string }) => `${f.name}: ${f.details}`).join('\n')
        }
      }

    } catch (error) {
      console.error(`Gemini API呼び出しエラー (試行 ${attempt + 1}/${maxRetries}):`, error)
      
      // 最後の試行でエラーの場合、エラーメッセージを返す
      if (attempt === maxRetries - 1) {
        console.log('Gemini API接続に失敗しました。')
        return {
          safe: false,
          detected_food: null,
          message: '一時的にGeminiが使用できません。時間をおいて試してみてください。',
          details: ''
        }
      }
      
      // リトライの場合は少し待機
      if (attempt < maxRetries - 1) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  // ここには到達しないはずですが、念のため
  return {
    safe: false,
    detected_food: null,
    message: '一時的にGeminiが使用できません。時間をおいて試してみてください。',
    details: ''
  }
}

export async function POST(request: NextRequest) {
  console.log('API called at:', new Date().toISOString())
  
  try {
    // 1. Rate Limiting チェック
    const rateLimitResult = limiter.check(request)
    if (!rateLimitResult.allowed) {
      console.log('Rate limit exceeded')
      return NextResponse.json(
        { 
          error: 'リクエスト制限に達しました。しばらく時間をおいてからお試しください。',
          retryAfter: rateLimitResult.resetTime 
        },
        { status: 429 }
      )
    }

    // 2. Content-Type チェック
    const contentTypeValidation = validateContentType(request)
    if (!contentTypeValidation.isValid) {
      console.log('Invalid content type:', contentTypeValidation.error)
      return NextResponse.json(
        { error: 'リクエスト形式が不正です' },
        { status: 400 }
      )
    }

    // 3. Referrer チェック（開発環境では無効化）
    if (process.env.NODE_ENV === 'production') {
      const referrerValidation = validateReferrer(request)
      if (!referrerValidation.isValid) {
        console.log('Invalid referrer:', referrerValidation.error)
        return NextResponse.json(
          { error: 'アクセス元が不正です' },
          { status: 403 }
        )
      }
    }

    // 4. User-Agent チェック
    const userAgentValidation = validateUserAgent(request)
    if (!userAgentValidation.isValid) {
      console.log('Invalid user agent:', userAgentValidation.error)
      return NextResponse.json(
        { error: 'アクセスが拒否されました' },
        { status: 403 }
      )
    }

    const body = await request.json()
    console.log('Request body received, has image:', !!body?.image)

    if (!body || !body.image) {
      console.log('Error: No image data provided')
      return NextResponse.json(
        { error: '画像データが提供されていません' },
        { status: 400 }
      )
    }

    const imageData = body.image

    // 5. 画像データのサニタイゼーションと検証
    const sanitizationResult = sanitizeAndValidatePrompt(imageData)
    if (!sanitizationResult.isSafe) {
      console.log('Image validation failed:', sanitizationResult.reason)
      return NextResponse.json(
        { error: sanitizationResult.reason },
        { status: 400 }
      )
    }

    console.log('Image data length:', imageData.length)

    // Gemini API呼び出し（安全なプロンプトを使用）
    if (!process.env.GEMINI_API_KEY) {
      console.log('Error: GEMINI_API_KEY not set')
      return NextResponse.json(
        { error: 'Gemini APIキーが設定されていません' },
        { status: 500 }
      )
    }
    
    console.log('Calling Gemini API...')
    const result = await callGeminiAPI(imageData, sanitizationResult.sanitizedPrompt!)
    console.log('Gemini API result:', result)

    return NextResponse.json({
      success: true,
      result: result
    })

  } catch (error) {
    console.error('分析エラー:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: '分析中にエラーが発生しました。時間をおいて再度お試しください。' },
      { status: 500 }
    )
  }
}
