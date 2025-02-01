import { FastifyInstance } from "fastify";
import { sendChatMessage } from "./routes";

export const chatRouter = async (fastify: FastifyInstance) => {
    fastify.register(sendChatMessage)
}