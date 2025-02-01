import { IDocInfo, IDocType } from "@/entities/doc";
import { FastifyInstance, FastifyRequest } from "fastify";
import { Document } from '@langchain/core/documents'
import { createDocsFromFile, createDocsFromWeb } from "@/large_language_models/docs";
import { createChunks } from "@/large_language_models/lib/utils";
import { getPineconeStore } from "@/large_language_models/vectorStore";

export const addDocsToVectorStoreRoute = async (fastify: FastifyInstance) => {
    fastify.route({
        method: 'POST',
        url: '/addDocsToVectorStore',
        handler: async (request: FastifyRequest<{ Body: IDocInfo<IDocType> }>, reply) => {
            const { name, type, url } = request.body

            try {
                let docs: Document<Record<string, any>>[];

                switch (type) {
                    case "file":
                        const { mimetype } = request.body as IDocInfo<'file'>
                        docs = await createDocsFromFile(url, mimetype)
                        break

                    case "web":
                        docs = await createDocsFromWeb(url)
                        break

                    default:
                        return reply.code(400).send({
                            msg: 'Неверный тип документа'
                        })
                }

                const chunks = await createChunks(docs)

                const vectorStore = await getPineconeStore()

                await vectorStore.addDocuments(chunks)

                reply.code(200).send({
                    msg: `Документ добавлен`,
                    name
                })

            } catch (error) {
                console.error(error)
                reply.code(500).send({
                    msg: 'Ошибка обработки запроса'
                })
            }
        }
    })
}