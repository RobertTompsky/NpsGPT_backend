import { FastifyInstance } from "fastify"
import fs from 'fs-extra'
import Busboy, { BusboyHeaders } from '@fastify/busboy';
import path from 'path';
import { pipeline } from 'stream';
import util from 'util';
import { VALID_FILE_TYPES } from "@/entities/doc/lib";
import { checkIfUploadsFolderExists } from "@/lib/utils";

export const uploadFileRoute = async (fastify: FastifyInstance) => {
    fastify.route({
        method: "POST",
        url: '/uploadFile',
        handler: async (request, reply) => {
            const folder = './uploads'
            await checkIfUploadsFolderExists(folder)

            const headers: BusboyHeaders = {
                'content-type': request.headers['content-type'],
            }

            const busboy = new Busboy({ headers })

            request.raw.pipe(busboy)

            let filepath: string | null = null
            let mimetype: string | null = null

            try {
                const pump = util.promisify(pipeline)

                await new Promise<void>((resolve, reject) => {
                    busboy.on('file', async (fieldname, file, filename, _encoding, bb_mimetype) => {
                        const isValidMimetype = (Object.values(VALID_FILE_TYPES) as string[]).includes(bb_mimetype)

                        if (isValidMimetype) {
                            const formattedFilename = `${fieldname}-${Date.now()}${path.extname(filename)}`;
                            const destFilepath = path.join(folder, formattedFilename)

                            await pump(file, fs.createWriteStream(destFilepath))

                            filepath = destFilepath
                            mimetype = bb_mimetype

                            resolve()
                        } else {
                            return reject(new Error('Файл не поддерживается'))
                        }

                    })

                    busboy.on('finish', () => {
                        console.log('Файл загружен')
                    })

                    busboy.on('error', (error) => {
                        console.error(error)
                        return reject(error)
                    })
                })

                return reply.code(200).send({
                    filepath,
                    mimetype
                })
            } catch (error) {
                return reply.status(500).send({
                    message: 'Не удалось загрузить файл'
                });
            }
        }
    })
}