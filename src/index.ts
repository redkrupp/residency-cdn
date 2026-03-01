export default {
  async fetch(request, env) {
    // Get the origin from the request
    const origin = request.headers.get('Origin')
    
    // Check if origin matches medresidency.com or its subdomains
    const isAllowedOrigin = origin && /^https?:\/\/(?:[a-z0-9-]+\.)*medresidency\.com(?::\d+)?$/i.test(origin)
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    try {
      // Basic auth check
      if (env.REQUIRE_AUTH) {
        const authorized = await authenticate(request, env)
        if (!authorized) {
          return new Response('Unauthorized', { status: 401 })
        }
      }

      // Rate limiting
      const clientIP = request.headers.get('cf-connecting-ip')
      const rateLimitKey = `ratelimit:${clientIP}`

      // Get and increment counter
      const currentRequests = parseInt((await env.KV.get(rateLimitKey)) || '0')
      if (currentRequests > 100) {
        return new Response('Rate limit exceeded', { status: 429 })
      }

      // Set counter with 60 second expiration
      await env.KV.put(rateLimitKey, (currentRequests + 1).toString(), {
        expirationTtl: 60,
      })

      const url = new URL(request.url)
      const path = url.pathname.slice(1)

      // Parse image transformation parameters
      const width = url.searchParams.get('w')
      const height = url.searchParams.get('h')
      const quality = url.searchParams.get('q') || '85'
      const format = url.searchParams.get('f') || 'auto'

      const object = await env.MY_BUCKET.get(path)

      if (!object) {
        return new Response('Image not found', { status: 404 })
      }

      const headers = new Headers()
      headers.set('Cache-Control', 'public, max-age=31536000')
      headers.set('Content-Type', object.httpMetadata.contentType || 'image/jpeg')
      
      // Ensure CORS headers are added to your response
      headers.set('Access-Control-Allow-Origin', isAllowedOrigin ? origin : 'null')

      return new Response(object.body, {
        headers,
        cf: {
          image: {
            fit: 'scale-down',
            width: width ? parseInt(width) : undefined,
            height: height ? parseInt(height) : undefined,
            quality: parseInt(quality),
            format,
          },
        },
      })
    } catch (err) {
      if (!(err instanceof Error)) {
        throw new Error(`Was thrown a non-error: ${err}`)
      }

      console.error('Error serving image:', err)
      return new Response('Error processing image', {
        status: 500,
        headers: {
          'Content-Type': 'text/plain',
        },
      })
    }
  },
}