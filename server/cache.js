class Cache {
  constructor(ttl = 300000) {
    this.cache = new Map()
    this.ttl = ttl
    this.timers = new Map()
  }

  set(key, value, customTTL) {
    const ttl = customTTL || this.ttl
    const expiry = Date.now() + ttl
    
    this.cache.set(key, { value, expiry })
    
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
    }
    
    const timer = setTimeout(() => {
      this.delete(key)
    }, ttl)
    
    this.timers.set(key, timer)
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item) return null
    
    if (Date.now() > item.expiry) {
      this.delete(key)
      return null
    }
    
    return item.value
  }

  has(key) {
    return this.get(key) !== null
  }

  delete(key) {
    this.cache.delete(key)
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key))
      this.timers.delete(key)
    }
  }

  clear() {
    this.cache.clear()
    this.timers.forEach(timer => clearTimeout(timer))
    this.timers.clear()
  }

  get size() {
    return this.cache.size
  }

  keys() {
    return Array.from(this.cache.keys())
  }

  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.delete(key)
      }
    }
  }
}

const cacheInstances = new Map()

export function getCache(name, ttl) {
  if (!cacheInstances.has(name)) {
    cacheInstances.set(name, new Cache(ttl))
  }
  return cacheInstances.get(name)
}

export function clearCache(name) {
  if (name) {
    const cache = cacheInstances.get(name)
    if (cache) {
      cache.clear()
    }
  } else {
    cacheInstances.forEach(cache => cache.clear())
  }
}

export function cacheMiddleware(ttl = 300000) {
  return (req, res, next) => {
    const key = `cache:${req.method}:${req.originalUrl}`
    const cache = getCache('api', ttl)
    
    const cached = cache.get(key)
    if (cached) {
      res.setHeader('X-Cache', 'HIT')
      return res.json(cached)
    }
    
    res.setHeader('X-Cache', 'MISS')
    
    const originalJson = res.json.bind(res)
    res.json = function(data) {
      if (res.statusCode === 200) {
        cache.set(key, data, ttl)
      }
      return originalJson(data)
    }
    
    next()
  }
}

export function invalidateCache(pattern) {
  const cache = getCache('api')
  const keys = cache.keys()
  
  for (const key of keys) {
    if (pattern.test(key)) {
      cache.delete(key)
    }
  }
}

export default Cache