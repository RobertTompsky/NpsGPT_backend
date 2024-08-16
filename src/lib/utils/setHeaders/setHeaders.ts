import { FastifyReply } from "fastify"

export const setHeaders = (headers: { key: string, value: string}[], reply: FastifyReply) => {
    headers.forEach(header => {
        reply.raw.setHeader(header.key, header.value)
    })
}