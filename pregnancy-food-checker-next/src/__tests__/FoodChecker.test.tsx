/**
 * FoodChecker コンポーネントのテスト
 */

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import FoodChecker from '../components/FoodChecker'

// fetchのモック
const mockFetch = jest.fn()
global.fetch = mockFetch

// FileReaderのモック
class MockFileReader {
  readAsDataURL = jest.fn()
  onload: ((event: ProgressEvent<FileReader>) => void) | null = null
  result: string | ArrayBuffer | null = null
  addEventListener = jest.fn()
  removeEventListener = jest.fn()

  constructor() {
    this.readAsDataURL.mockImplementation((file: File) => {
      setTimeout(() => {
        this.result = 'data:image/png;base64,testdata'
        if (this.onload) {
          const mockEvent = {
            target: { result: this.result }
          } as unknown as ProgressEvent<FileReader>
          this.onload(mockEvent)
        }
      }, 0)
    })
  }
}

global.FileReader = MockFileReader as any

// navigatorのモック
Object.defineProperty(global.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  writable: true
})

describe('FoodChecker Component', () => {
  let user: ReturnType<typeof userEvent.setup>

  beforeEach(() => {
    jest.resetAllMocks()
    user = userEvent.setup()
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          safe: true,
          message: 'この食事は妊娠中でもリスクが低そうです',
          details: ''
        }
      })
    })
  })

  test('初期画面が正しく表示される', () => {
    render(<FoodChecker />)
    
    expect(screen.getByText('妊娠中の')).toBeInTheDocument()
    expect(screen.getByText('食事チェッカー')).toBeInTheDocument()
    expect(screen.getByText('📷 写真を撮影')).toBeInTheDocument()
    expect(screen.getByText('📁 ファイルから選択')).toBeInTheDocument()
    // 部分一致でテキストを確認
    expect(screen.getByText((content) => {
      return content.includes('※このアプリは、妊娠中の食事選びの参考として')
    })).toBeInTheDocument()
  })

  test('画像ファイルをアップロードできる', async () => {
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    // ファイルがアップロードされ、チェック開始ボタンが有効になることを確認
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
  })

  test('分析が正常に実行される', async () => {
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    const analyzeButton = screen.getByText('チェック開始')
    await user.click(analyzeButton)
    
    await waitFor(() => {
      expect(screen.getByText((content) => 
        content.includes('この食事は妊娠中でもリスクが低そうです')
      )).toBeInTheDocument()
    })
  })

  test('正常な分析結果（安全）が表示される', async () => {
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    await user.click(screen.getByText('チェック開始'))
    
    await waitFor(() => {
      expect(screen.getByText((content) =>
        content.includes('この食事は妊娠中でもリスクが低そうです')
      )).toBeInTheDocument()
      expect(screen.getByText('新しい写真をチェック')).toBeInTheDocument()
    })
  })

  test('リスクありの分析結果が表示される', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        result: {
          safe: false,
          message: 'リスクがある食品が含まれている可能性があります',
          detected_food: ['生ハム', '生卵'],
          details: 'リステリア菌のリスクがあります。妊娠中は避けることをおすすめします。'
        }
      })
    })
    
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    await user.click(screen.getByText('チェック開始'))
    
    await waitFor(() => {
      expect(screen.getByText((content) =>
        content.includes('リスクがある食品が含まれている可能性があります')
      )).toBeInTheDocument()
      expect(screen.getByText('新しい写真をチェック')).toBeInTheDocument()
    })
  })

  test('レート制限エラーが適切に表示される', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({
        error: 'レート制限に達しました'
      })
    })
    
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    await user.click(screen.getByText('チェック開始'))
    
    await waitFor(() => {
      expect(screen.getByText((content) =>
        content.includes('分析中にエラーが発生しました')
      )).toBeInTheDocument()
    })
  })

  test('一般的なAPIエラーが適切に表示される', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: 'Internal Server Error'
      })
    })
    
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    await user.click(screen.getByText('チェック開始'))
    
    await waitFor(() => {
      expect(screen.getByText((content) =>
        content.includes('エラーが発生しました')
      )).toBeInTheDocument()
    })
  })

  test('ネットワークエラーが適切に表示される', async () => {
    mockFetch.mockRejectedValue(new Error('Network Error'))
    
    render(<FoodChecker />)
    
    const file = new File(['test'], 'test.png', { type: 'image/png' })
    const input = screen.getByLabelText('画像をアップロード') as HTMLInputElement
    
    await user.upload(input, file)
    
    await waitFor(() => {
      expect(screen.getByText('チェック開始')).toBeEnabled()
    })
    
    await user.click(screen.getByText('チェック開始'))
    
    await waitFor(() => {
      expect(screen.getByText((content) =>
        content.includes('分析中にエラーが発生しました')
      )).toBeInTheDocument()
    })
  })

  test('LINE WebViewでの警告表示', () => {
    // User-AgentをLINE WebViewに設定
    Object.defineProperty(global.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Line/11.10.0',
      writable: true
    })
    
    render(<FoodChecker />)
    
    // WebView環境の警告が表示されることを期待
    expect(screen.getByText((content) =>
      content.includes('アプリ内ブラウザでご利用中です')
    )).toBeInTheDocument()
    expect(screen.getByText('📷 写真を撮影（制限有り）')).toBeInTheDocument()
  })
})
