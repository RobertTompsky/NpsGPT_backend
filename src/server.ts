import { FastifyServerOptions } from 'fastify'
import { buildApp } from './app'

const start = async () => {
    //вроде как для логгирования используется библиотека pino
    const options: Partial<FastifyServerOptions> = {
        logger: true
    }

    const app = await buildApp(options)

    try {
        await app.listen({
            port: 3000,
            host: 'localhost'
        })
    } catch (error) {
        app.log.error(error)
        process.exit(1)
    }

}

start()