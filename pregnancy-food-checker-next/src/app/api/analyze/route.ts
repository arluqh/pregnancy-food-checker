import { NextRequest, NextResponse } from 'next/server'

async function callGeminiAPI(imageData: string) {
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

      const prompt = (
        "妊婦がとる食事の画像を元に、そこに妊婦にとってリスクのある食材が含まれているかを判定する手助けをしてください。この画像に含まれる食品名をリストアップし、それぞれが妊婦にとってリスクがあるかどうかを判定してください。" +
        "必ず次のJSON形式で返してください。" +
        "\n\n" +
        "{\n  \"foods\": [\n    {\"name\": \"食品名\", \"risk\": true/false, \"details\": \"リスクの説明（なければ空文字）\"},\n    ...\n  ]\n}" +
        "\n\nリスクがある食品がなければ、'risk': false だけの配列で返してください。説明文や表は不要です。JSONのみを返してください。"
      )

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

      // レスポンスからJSON部分を抽出（元のPythonコードと同じ方式）
      const match = text.match(/\{[\s\S]*\}/)
      if (!match) {
        return {
          safe: false,
          detected_food: null,
          message: 'GeminiのレスポンスからJSONを抽出できませんでした',
          details: text
        }
      }

      const foodsJson = match[0]
      let foods: Array<{ name: string; risk: boolean; details: string }>
      try {
        const foodsData = JSON.parse(foodsJson)
        foods = foodsData.foods || []
      } catch (e) {
        // JSONが不完全な場合、修復を試みる
        let repairedJson = foodsJson
        
        // 不完全な配列を修復
        if (!repairedJson.endsWith('}')) {
          repairedJson = repairedJson.replace(/,?\s*$/, '') + ' } ] }'
        }
        
        // 再度パースを試行
        try {
          const foodsData = JSON.parse(repairedJson)
          foods = foodsData.foods || []
        } catch {
          return {
            safe: false,
            detected_food: null,
            message: `GeminiのJSONパースエラー: ${e instanceof Error ? e.message : 'Unknown error'}`,
            details: `元のJSON: ${foodsJson}\n修復試行: ${repairedJson}`
          }
        }
      }

      // リスク食品抽出
      const riskyFoods = foods.filter(f => f.risk === true)
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
          detected_food: riskyFoods.map(f => f.name),
          message: 'リスクがある食品が含まれている可能性があります。詳細をご確認ください。',
          details: riskyFoods.map(f => `${f.name}: ${f.details}`).join('\n')
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
    console.log('Image data length:', imageData.length)

    // Base64画像データの検証（簡易）
    if (!imageData.startsWith('data:image/')) {
      console.log('Error: Invalid image format')
      return NextResponse.json(
        { error: '無効な画像形式です' },
        { status: 400 }
      )
    }

    // Gemini API呼び出し（Googleログイン不要）
    // APIキーが設定されていればGemini APIを使用、なければエラーを返す
    if (!process.env.GEMINI_API_KEY) {
      console.log('Error: GEMINI_API_KEY not set')
      return NextResponse.json(
        { error: 'Gemini APIキーが設定されていません' },
        { status: 500 }
      )
    }
    
    console.log('Calling Gemini API...')
    const result = await callGeminiAPI(imageData)
    console.log('Gemini API result:', result)

    return NextResponse.json({
      success: true,
      result: result
    })

  } catch (error) {
    console.error('分析エラー:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: `分析中にエラーが発生しました: ${error instanceof Error ? error.message : 'Unknown error'}` },
      { status: 500 }
    )
  }
}
