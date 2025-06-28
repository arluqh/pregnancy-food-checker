'use client'

import dynamic from 'next/dynamic'

// クライアントサイドでのみレンダリングすることでHydrationエラーを回避
const FoodChecker = dynamic(() => import('@/components/FoodChecker'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-green-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
        <p className="text-gray-600">読み込み中...</p>
      </div>
    </div>
  )
})

export default function Home() {
  return <FoodChecker />
}
