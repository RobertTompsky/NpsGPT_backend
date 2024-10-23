import { FastifyInstance } from "fastify";
import { uploadFileRoute, addDocsToVectorStoreRoute } from "./routes";

export const docRouter = async (fastify: FastifyInstance) => {
    fastify.register(uploadFileRoute)
    fastify.register(addDocsToVectorStoreRoute)
}