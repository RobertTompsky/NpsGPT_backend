import { FastifyInstance } from 'fastify'
import { chatRouter } from './entities/chat'
import { docRouter } from './entities/doc'

export const router = async (fastify: FastifyInstance) => {
    fastify.get('/', (_request, reply) => {
        reply.send({
            msg: 'О привет'
        })
    })

    fastify.register(chatRouter, {
        prefix: '/chat'
    })

    fastify.register(docRouter, {
        prefix: '/doc'
    })
}