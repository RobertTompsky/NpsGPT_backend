import Fastify, { FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import { router } from './router'

export const buildApp = (options: Partial<FastifyServerOptions>) => {
    const fastify = Fastify(options)

    fastify.register(cors)
    fastify.register(router)

    return fastify
}