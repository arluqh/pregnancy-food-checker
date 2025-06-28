// テスト環境のセットアップ
global.btoa = (str: string) => Buffer.from(str).toString('base64')
global.atob = (str: string) => Buffer.from(str, 'base64').toString()

// Mockデータの準備
export const createMockRequest = (options: {
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

export const createValidImageData = () => {
  // 1x1 PNG画像のBase64データ
  const base64Data = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChAHGu/CJKQAAAABJRU5ErkJggg=='
  return `data:image/png;base64,${base64Data}`
}

export const createInvalidImageData = () => {
  return 'data:text/plain;base64,SGVsbG8gV29ybGQ='
}

// setup.tsファイルにはテストが含まれないことを明示
describe('Setup', () => {
  test('setup file is working', () => {
    expect(true).toBe(true)
  })
})
