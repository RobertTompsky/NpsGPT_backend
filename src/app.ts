import Fastify, { FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import { router } from './router'
import 'dotenv/config'
import { setMultipart } from './lib/utils'

export const buildApp = (options: Partial<FastifyServerOptions>) => {
    const fastify = Fastify(options)

    fastify.addContentTypeParser('multipart', setMultipart)

    fastify.register(cors)
    fastify.register(router)

    return fastify
}