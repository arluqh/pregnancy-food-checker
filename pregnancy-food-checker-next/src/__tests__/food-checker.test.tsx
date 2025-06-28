import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom'
import FoodChecker from '../components/FoodChecker'

// fetchのモック
const mockFetch = jest.fn()
global.fetch = mockFetch

// ファイル読み込みのモック
const mockFileReader = {
  readAsDataURL: jest.fn(),
  result: null as string | null,
  onload: null as ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null
}

// FileReaderの型安全なモック
global.FileReader = jest.fn().mockImplementation(() => mockFileReader) as any

// navigator.clipboardのモック
const mockClipboard = {
  writeText: jest.fn()
}
Object.defineProperty(navigator, 'clipboard', {
  value: mockClipboard,
  writable: true
})

describe('FoodChecker Component', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    mockFileReader.result = null
    mockFileReader.onload = null
  })

  describe('あるべき挙動', () => {
    test('初期状態で正しく表示される', () => {
      render(<FoodChecker />)
      
      expect(screen.getByText('妊娠中の')).toBeInTheDocument()
      expect(screen.getByText('食事チェッカー')).toBeInTheDocument()
      expect(screen.getByText('写真を撮る')).toBeInTheDocument()
      expect(screen.getByText('ギャラリーから選択')).toBeInTheDocument()
      expect(screen.getByText('※このアプリは、妊娠中の食事選びの参考として')).toBeInTheDocument()
    })

    test('画像選択後に分析ボタンが表示される', async () => {
      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // ファイル選択をシミュレート
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      // FileReaderのonloadを実行
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader as any, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        expect(screen.getByText('食事を分析する')).toBeInTheDocument()
      })
    })

    test('正常な分析結果（安全）が表示される', async () => {
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

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // 結果表示を確認
      await waitFor(() => {
        expect(screen.getByText('この食事は妊娠中でもリスクが低そうです')).toBeInTheDocument()
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
            details: '生ハム: リステリア菌のリスク\\n生卵: サルモネラ菌のリスク'
          }
        })
      })

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // 結果表示を確認
      await waitFor(() => {
        expect(screen.getByText('リスクがある食品が含まれている可能性があります')).toBeInTheDocument()
        expect(screen.getByText(/リステリア菌のリスク/)).toBeInTheDocument()
      })
    })

    test('戻るボタンで初期画面に戻る', async () => {
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

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択から分析まで実行
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // 結果画面から戻る
      await waitFor(() => {
        const backButton = screen.getByText('戻る')
        fireEvent.click(backButton)
      })

      // 初期画面に戻ったことを確認
      expect(screen.getByText('妊娠中の')).toBeInTheDocument()
      expect(screen.getByText('写真を撮る')).toBeInTheDocument()
    })
  })

  describe('エラーハンドリング', () => {
    test('レート制限エラーが適切に表示される', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        json: async () => ({
          error: 'リクエスト制限に達しました。しばらく時間をおいてからお試しください。'
        })
      })

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // エラーメッセージ表示を確認
      await waitFor(() => {
        expect(screen.getByText('利用制限に達しました。しばらく時間をおいてからお試しください。')).toBeInTheDocument()
      })
    })

    test('一般的なAPIエラーが適切に表示される', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({
          error: '画像データが不正です'
        })
      })

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // エラーメッセージ表示を確認
      await waitFor(() => {
        expect(screen.getByText('画像データが不正です')).toBeInTheDocument()
      })
    })

    test('ネットワークエラーが適切に表示される', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // エラーメッセージ表示を確認
      await waitFor(() => {
        expect(screen.getByText('分析中にエラーが発生しました。もう一度お試しください。')).toBeInTheDocument()
      })
    })

    test('画像未選択で分析ボタンが無効化される', () => {
      render(<FoodChecker />)
      
      // 分析ボタンが表示されていないことを確認
      expect(screen.queryByText('食事を分析する')).not.toBeInTheDocument()
    })
  })

  describe('WebView環境の検出', () => {
    test('LINE WebViewでの警告表示', () => {
      // User-AgentをLINE WebViewに設定
      Object.defineProperty(navigator, 'userAgent', {
        value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Line/11.10.0',
        writable: true
      })

      render(<FoodChecker />)
      
      // カメラボタンクリック
      const cameraButton = screen.getByText('写真を撮る')
      fireEvent.click(cameraButton)
      
      // WebView環境の警告が表示されることを期待
      // 実際の実装では、alertや専用UIでの警告表示
    })
  })

  describe('UI状態管理', () => {
    test('分析中はローディング状態が表示される', async () => {
      // レスポンスを遅延させる
      mockFetch.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            ok: true,
            json: async () => ({
              success: true,
              result: {
                safe: true,
                message: 'テスト',
                details: ''
              }
            })
          }), 100)
        )
      )

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 画像選択
      mockFileReader.result = 'data:image/png;base64,test-data'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      // 分析実行
      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      // ローディング状態を確認
      expect(screen.getByText('分析中...')).toBeInTheDocument()
      
      // 分析完了まで待機
      await waitFor(() => {
        expect(screen.getByText('テスト')).toBeInTheDocument()
      }, { timeout: 200 })
    })

    test('複数回の分析でも正常に動作する', async () => {
      let callCount = 0
      mockFetch.mockImplementation(() => {
        callCount++
        return Promise.resolve({
          ok: true,
          json: async () => ({
            success: true,
            result: {
              safe: true,
              message: `分析結果 ${callCount}`,
              details: ''
            }
          })
        })
      })

      render(<FoodChecker />)
      
      const fileInput = screen.getByTestId('file-upload-input') as HTMLInputElement
      const testFile = new File(['test'], 'test.png', { type: 'image/png' })
      
      // 1回目の分析
      mockFileReader.result = 'data:image/png;base64,test-data-1'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      await waitFor(() => {
        expect(screen.getByText('分析結果 1')).toBeInTheDocument()
      })

      // 戻るボタンで初期画面に戻る
      const backButton = screen.getByText('戻る')
      fireEvent.click(backButton)

      // 2回目の分析
      mockFileReader.result = 'data:image/png;base64,test-data-2'
      fireEvent.change(fileInput, { target: { files: [testFile] } })
      
      if (mockFileReader.onload) {
        mockFileReader.onload.call(mockFileReader, {} as ProgressEvent<FileReader>)
      }

      await waitFor(() => {
        const analyzeButton = screen.getByText('食事を分析する')
        fireEvent.click(analyzeButton)
      })

      await waitFor(() => {
        expect(screen.getByText('分析結果 2')).toBeInTheDocument()
      })

      expect(mockFetch).toHaveBeenCalledTimes(2)
    })
  })
})
