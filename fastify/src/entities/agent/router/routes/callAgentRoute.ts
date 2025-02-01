import { callAgent } from "@/large_language_models/agents/callAgent";
import { FastifyInstance } from "fastify";

export const callAgentRoute = async (fastify: FastifyInstance) => {
    fastify.route({
        method: 'GET',
        url: '/callAgent',
        handler: async (request, reply) => {
            try {
                await callAgent()

                reply.code(200).send({
                    msg: "Запрос выполнен"
                })
            } catch (error) {
                console.error(error)
            }
        }
    })
}