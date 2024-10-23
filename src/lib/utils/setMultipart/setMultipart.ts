import { FastifyRequest } from "fastify"
import { IncomingMessage } from "http"

const kMultipart = Symbol('multipart')

export const setMultipart = (
    req: FastifyRequest,
    _payload: IncomingMessage,
    done: (err: Error | null) => void
) => {
    (req)[kMultipart] = true
    done(null)
}