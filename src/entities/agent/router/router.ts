import { FastifyInstance } from "fastify";
import { callAgentRoute } from "./routes/callAgentRoute";

export const agentRouter = async (fastify: FastifyInstance) => {
    fastify.register(callAgentRoute)
}