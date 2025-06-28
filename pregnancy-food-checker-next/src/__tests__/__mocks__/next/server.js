// Mock Next.js server module
const NextRequest = class MockNextRequest {
  constructor(input, init = {}) {
    this.url = input || 'http://localhost:3000'
    this.method = init.method || 'GET'
    this.headers = new Map()
    
    // Set up headers from init
    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
    
    this.body = init.body
  }
  
  json() {
    try {
      return Promise.resolve(JSON.parse(this.body || '{}'))
    } catch {
      return Promise.resolve({})
    }
  }
}

NextRequest.prototype.headers = {
  get: function(key) {
    return this.headers?.get(key.toLowerCase()) || null
  }
}

const NextResponse = class MockNextResponse {
  constructor(body, init = {}) {
    this.body = body
    this.status = init.status || 200
    this.ok = this.status >= 200 && this.status < 300
    this.headers = new Map()
    
    if (init.headers) {
      Object.entries(init.headers).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), value)
      })
    }
  }
  
  static json(object, init = {}) {
    return new NextResponse(JSON.stringify(object), {
      ...init,
      headers: {
        'content-type': 'application/json',
        ...init.headers
      }
    })
  }
  
  json() {
    try {
      return Promise.resolve(JSON.parse(this.body || '{}'))
    } catch {
      return Promise.resolve({})
    }
  }
}

module.exports = {
  NextRequest,
  NextResponse
}
