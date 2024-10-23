import { IChatRequestPayload } from "@/entities/chat";
import { createConversationChain, createRagChain } from "@/large_language_models/chains";
import { extractFromMessages } from "@/large_language_models/lib/utils";
import { STREAM_HEADERS } from "@/lib/data";
import { setHeaders } from "@/lib/utils";
import { Runnable } from "@langchain/core/runnables";
import { FastifyInstance, FastifyRequest } from "fastify";

export const sendChatMessage = async (fastify: FastifyInstance) => {
    fastify.route({
        method: 'POST',
        url: '/sendChatMessage',
        handler: async (request: FastifyRequest<{ Body: IChatRequestPayload }>, reply) => {
            const { messages, chatId, prompt, model, type } = request.body
            const { previousMessages, currentInput } = extractFromMessages(messages)

            setHeaders(STREAM_HEADERS, reply)

            try {
                let chain: Runnable

                switch (type) {
                    case "chatbot":
                        chain = await createConversationChain({
                            messages: previousMessages,
                            prompt,
                            model
                        });
                        break

                    case "qa":
                        chain = await createRagChain({
                            messages,
                            prompt,
                            model
                        });
                        break

                    default:
                        throw new Error('Неверный тип чата')
                }
                
                const stream = await chain.stream(
                    {
                        input: currentInput
                    },
                    {
                        configurable: {
                            sessionId: chatId
                        }
                    }
                )

                for await (const chunk of stream) {
                    //console.log(chunk)
                    reply.raw.write(chunk)
                }
                reply.raw.end()

            } catch (error) {
                console.log(error)
                reply.code(500).send({
                    error: error.message
                })
            }
        }
    })
}
