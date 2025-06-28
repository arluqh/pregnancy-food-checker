'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Camera, CheckCircle, AlertTriangle } from 'lucide-react'
import Image from 'next/image'

const API_BASE_URL = ''  // Next.js API routesは同一ドメインなので空文字

interface AnalysisResult {
  safe: boolean
  message: string
  details: string
}

export default function FoodChecker() {
  const [currentView, setCurrentView] = useState('main') // 'main', 'result'
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCameraMode, setIsCameraMode] = useState(false)
  const [isWebView, setIsWebView] = useState(false)

  // WebView環境検出
  const detectWebView = () => {
    const userAgent = navigator.userAgent.toLowerCase()
    
    // LINE WebView検出
    const isLineWebView = userAgent.includes('line')
    
    // その他のWebView検出（Instagram, Facebook, Twitter等）
    const isInstagramWebView = userAgent.includes('instagram')
    const isFacebookWebView = userAgent.includes('fbav') || userAgent.includes('fban')
    const isTwitterWebView = userAgent.includes('twitter')
    
    // iOS WebView検出
    const isIOSWebView = /iphone|ipad|ipod/.test(userAgent) && !userAgent.includes('safari')
    
    // Android WebView検出
    const isAndroidWebView = userAgent.includes('wv') || userAgent.includes('webview')
    
    return isLineWebView || isInstagramWebView || isFacebookWebView || isTwitterWebView || isIOSWebView || isAndroidWebView
  }

  // コンポーネントマウント時にWebView環境をチェック
  useState(() => {
    setIsWebView(detectWebView())
  })

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleCameraCapture = async () => {
    setIsCameraMode(true)
    
    try {
      // WebView環境の場合は、外部ブラウザで開くことを推奨
      if (isWebView) {
        // フォールバック: ファイル選択（WebViewでも動作する）
        const input = document.getElementById('camera-capture') as HTMLInputElement
        if (input) {
          input.click()
        }
      } else {
        // 通常のブラウザの場合
        const input = document.getElementById('camera-capture') as HTMLInputElement
        if (input) {
          input.click()
        }
      }
    } finally {
      // 少し遅延してからカメラモードを解除
      setTimeout(() => setIsCameraMode(false), 1000)
    }
  }

  const openInExternalBrowser = () => {
    // 現在のURLを外部ブラウザで開くためのメッセージを表示
    const currentUrl = window.location.href
    
    // クリップボードにURLをコピー
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(currentUrl)
    }
    
    alert('カメラ機能を使用するには、外部ブラウザ（Safari、Chrome等）で開いてください。\n\nURLがコピーされました。\nブラウザのアドレスバーに貼り付けてアクセスしてください。')
  }

  const handleAnalyze = async () => {
    if (!selectedImage) return
    
    setIsAnalyzing(true)
    
    try {
      // APIエンドポイントにPOSTリクエストを送信
      const body = {
        image: selectedImage
      }
      const response = await fetch(`${API_BASE_URL}/api/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body)
      })
      console.log(response.body)
      
      if (!response.ok) {
        throw new Error('分析に失敗しました')
      }
      
      const data = await response.json()
      
      if (data.success) {
        setAnalysisResult({
          safe: data.result.safe,
          message: data.result.message,
          details: data.result.details || ''
        })
        setCurrentView('result')
      } else {
        throw new Error(data.error || '分析に失敗しました')
      }
    } catch (error) {
      console.error('分析エラー:', error)
      setAnalysisResult({
        safe: false,
        message: '分析中にエラーが発生しました。もう一度お試しください。',
        details: ''
      })
      setCurrentView('result')
    } finally {
      setIsAnalyzing(false)
    }
  }

  const resetApp = () => {
    setCurrentView('main')
    setSelectedImage(null)
    setAnalysisResult(null)
    setIsAnalyzing(false)
  }

  if (currentView === 'result' && analysisResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-green-50 flex flex-col">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <Card className={`w-full max-w-md ${analysisResult.safe ? 'bg-green-50' : 'bg-orange-50'} border-none shadow-lg`}>
            <CardContent className="p-8 text-center">
              {analysisResult.safe ? (
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
              ) : (
                <AlertTriangle className="w-16 h-16 text-orange-500 mx-auto mb-6" />
              )}
              
              <h2 className={`text-2xl font-bold mb-4 ${analysisResult.safe ? 'text-green-700' : 'text-orange-700'}`}>
                {analysisResult.safe ? 'リスク低' : '注意が必要です'}
              </h2>
              
              <p className="text-gray-700 mb-6 leading-relaxed">
                {analysisResult.message}
              </p>
              
              {selectedImage && (
                <div className="mb-6">
                  <Image 
                    src={selectedImage} 
                    alt="分析された食事" 
                    width={128}
                    height={128}
                    className="w-32 h-32 object-cover rounded-lg mx-auto shadow-md"
                  />
                </div>
              )}
              
              {analysisResult.details && (
                <div className="text-sm text-gray-600 mb-6 text-left">
                  <h3 className="font-semibold text-center mb-3 text-orange-700">詳細情報</h3>
                  <div className="space-y-3">
                    {analysisResult.details.split('\n').map((detail: string, index: number) => {
                      const [foodName, ...descParts] = detail.split(':')
                      const description = descParts.join(':').trim()
                      
                      if (foodName && description) {
                        return (
                          <div key={index} className="bg-white p-3 rounded-lg border border-orange-100">
                            <div className="font-medium text-orange-800 mb-1">
                              {foodName.trim()}
                            </div>
                            <div className="text-gray-700 text-xs leading-relaxed">
                              {description}
                            </div>
                          </div>
                        )
                      }
                      return null
                    })}
                  </div>
                </div>
              )}
              
              <Button 
                onClick={resetApp}
                className={`w-full py-3 text-white font-medium rounded-full ${
                  analysisResult.safe ? 'bg-green-500 hover:bg-green-600' : 'bg-orange-500 hover:bg-orange-600'
                }`}
              >
                新しい写真をチェック
              </Button>
            </CardContent>
          </Card>
        </div>
        
        {/* Bottom Navigation */}
        <footer className="bg-gradient-to-r from-pink-100 via-green-100 to-pink-100 border-t border-gray-200 p-4 text-center text-xs text-gray-500 select-none">
          <div className="mb-2">
            <span>妊娠中の食事チェッカー &copy; 2025</span>
            <span className="mx-2">|</span>
            <span>健康と安全をサポートします</span>
          </div>
          <div className="text-gray-600 leading-relaxed">
            ※このアプリは、妊娠中の食事選びの参考として個人が制作したものです。表示される情報は、すべてのリスクを網羅・保証するものではありません。ご心配な場合や体調に不安があるときは、必ず医師や専門家にご相談ください。
          </div>
        </footer>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-green-50 flex flex-col">
      {/* Header */}
      <div className="text-center py-8 px-6">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          妊娠中の
        </h1>
        <h1 className="text-3xl font-bold text-gray-800">
          食事チェッカー
        </h1>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md space-y-6">
          {/* Camera Icon */}
          <div className="text-center">
            <Camera className="w-24 h-24 text-gray-600 mx-auto mb-6" />
          </div>

          {/* WebView Notice */}
          {isWebView && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="text-sm text-yellow-800 text-center">
                <p className="font-semibold mb-2">📱 アプリ内ブラウザでご利用中です</p>
                <p className="mb-2">カメラ機能を使用するには、外部ブラウザで開くことをおすすめします。</p>
                <Button 
                  onClick={openInExternalBrowser}
                  size="sm"
                  className="bg-yellow-500 hover:bg-yellow-600 text-white"
                >
                  外部ブラウザで開く
                </Button>
              </div>
            </div>
          )}

          {/* Image Preview */}
          {selectedImage && (
            <div className="text-center mb-6">
              <Image 
                src={selectedImage} 
                alt="選択された画像" 
                width={192}
                height={192}
                className="w-48 h-48 object-cover rounded-lg mx-auto shadow-md"
              />
            </div>
          )}

          {/* Upload Button */}
          <div className="space-y-4">
            {/* Camera Capture Button */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageUpload}
                className="hidden"
                id="camera-capture"
                autoFocus
              />
              <Button 
                variant="outline"
                onClick={handleCameraCapture}
                disabled={isCameraMode}
                className="w-full py-4 text-gray-700 border-2 border-gray-300 rounded-full hover:bg-gray-50 disabled:opacity-50"
              >
                {isCameraMode ? '📷 カメラ準備中...' : isWebView ? '📷 写真を撮影（制限有り）' : '📷 写真を撮影'}
              </Button>
            </div>
            
            {/* File Upload Button */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                id="file-upload"
              />
              <Button 
                variant="outline"
                className="w-full py-4 text-gray-700 border-2 border-gray-300 rounded-full hover:bg-gray-50"
              >
                📁 ファイルから選択
              </Button>
            </div>
          </div>

          {/* Analyze Button */}
          <Button 
            onClick={handleAnalyze}
            disabled={!selectedImage || isAnalyzing}
            className="w-full py-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? '分析中...' : 'チェック開始'}
          </Button>
        </div>
      </div>

      {/* Bottom Navigation */}
      <footer className="bg-gradient-to-r from-pink-100 via-green-100 to-pink-100 border-t border-gray-200 p-4 text-center text-xs text-gray-500 select-none">
        <div className="mb-2">
          <span>妊娠中の食事チェッカー &copy; 2025</span>
          <span className="mx-2">|</span>
          <span>健康と安全をサポートします</span>
        </div>
        <div className="text-gray-600 leading-relaxed">
          ※このアプリは、妊娠中の食事選びの参考として個人が制作したものです。表示される情報は、すべてのリスクを網羅・保証するものではありません。ご心配な場合や体調に不安があるときは、必ず医師や専門家にご相談ください。
        </div>
      </footer>
    </div>
  )
}
