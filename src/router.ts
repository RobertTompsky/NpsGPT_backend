import { FastifyInstance } from 'fastify'
import { chatRouter } from './entities/chat'

export const router = async (fastify: FastifyInstance) => {
    fastify.get('/', (request, reply) => {
        reply.send({
            msg: 'О привет'
        })
    })

    fastify.register(chatRouter, {
        prefix: '/chat'
    })
}