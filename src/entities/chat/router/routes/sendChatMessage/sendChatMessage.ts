import { IChatRequestPayload } from "@/entities/chat/types/types";
import { createConversationChain } from "@/large_language_models/chains";
import { extractFromMessages } from "@/large_language_models/lib/utils";
import { STREAM_HEADERS } from "@/lib/data";
import { setHeaders } from "@/lib/utils";
import { FastifyInstance, FastifyRequest } from "fastify";

export const sendChatMessage = async (fastify: FastifyInstance) => {
    fastify.route({
        method: 'POST',
        url: '/sendChatMessage',
        handler: async (request: FastifyRequest<{ Body: IChatRequestPayload }>, reply) => {
            const { messages, chatId } = request.body
            const { previousMessages, currentInput } = extractFromMessages(messages)

            setHeaders(STREAM_HEADERS, reply)
            
            try {
                const chain = await createConversationChain(previousMessages)
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
                    console.log(chunk)
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
