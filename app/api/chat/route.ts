import { kv } from '@vercel/kv'
import { OpenAIStream, StreamingTextResponse } from 'ai'
import OpenAI from 'openai'

import { auth } from '@/auth'
import { nanoid } from '@/lib/utils'

export const runtime = 'edge'

const anyscaleAI = new OpenAI({
  baseURL: 'https://api.endpoints.anyscale.com/v1',
  apiKey: 'esecret_iyt8cukznmr4lvr26rrc1esfrl'
})

export async function POST(req: Request) {
  const json = await req.json()
  const { messages, previewToken, selectedModel } = json
  // const userId = (await auth())?.user.id

  // if (!userId) {
  //   return new Response('Unauthorized', {
  //     status: 401
  //   })
  // }

  if (previewToken) {
    anyscaleAI.apiKey = previewToken
  } else {
    return new Response('Anyscale Endpoint Token missing', {
      status: 400
    })
  }

  if (!selectedModel) {
    return new Response('Model not selected', {
      status: 400
    })
  }

  const res = await anyscaleAI.chat.completions.create({
    model: selectedModel,
    messages,
    temperature: 0.7,
    stream: true
  })

  const stream = OpenAIStream(res, {
    async onCompletion(completion) {
      const title = json.messages[0].content.substring(0, 100)
      const id = json.id ?? nanoid()
      const createdAt = Date.now()
      const path = `/chat/${id}`
      const payload = {
        id,
        title,
        createdAt,
        path,
        messages: [
          ...messages,
          {
            content: completion,
            role: 'assistant'
          }
        ]
      }
      // await kv.hmset(`chat:${id}`, payload)
      // await kv.zadd(`user:chat:${userId}`, {
      //   score: createdAt,
      //   member: `chat:${id}`
      // })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'X-Content-Type-Options': 'nosniff'
    }
  })
}
