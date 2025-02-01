import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import 'dotenv/config'
import { cors } from 'hono/cors'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { callCryptoAgent, type IState } from '@models/callAgent'
import { isAIMessageChunk } from '@langchain/core/messages'
import { streamSSE } from "hono/streaming";

const schema = z.object({
  input: z.string(),
  threadId: z.string()
})

const app = new Hono()

app
  .use('/*', cors())
  .get('/', (c) => {
    return c.text('Hello Hono!')
  })
  .post(
    '/callAgent',
    zValidator('json', schema),
    async (c) => {
      const { input, threadId } = c.req.valid('json')

      const result = await callCryptoAgent({ input, threadId })

      return streamSSE(c, async (stream) => {
        try {
          for await (const { name, event, data } of result) {
            if (
              event === 'on_chat_model_stream' &&
              isAIMessageChunk(data.chunk)
            ) {
              const content = data.chunk.content as string

              let isToolCall = true

              if (isToolCall && content === '') {
                isToolCall = false
                continue
              }
              
              stream.writeSSE({
                data: content,
                event: name
              })
            }
    
            if (
              name === 'summarize_conversation' &&
              Array.isArray(data.output?.summary)
            ) {
              const summary = (data.output as IState).summary
              
              for (const point of summary) {
                stream.writeSSE({
                  data: point,
                  event: name
                })
                await stream.sleep(200)
              }
            }
          }
        } catch (error) {
          stream.writeln('Error')
          console.error(error)
        }
      })
    }
  )

const port = 3000
console.log(`Server is running on http://localhost:${port}`)

serve({
  fetch: app.fetch,
  port
})
