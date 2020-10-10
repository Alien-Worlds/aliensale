#!/usr/bin/env node

process.title = `time-server-${process.env.CONFIG}`;

const fetch = require('node-fetch');
const fs = require('fs');

const config = require(`../config.${process.env.CONFIG}`);

const fastify = require('fastify')({
    ignoreTrailingSlash: true,
    trustProxy: true,
    logger: true,
    serverTimeout: 5000
});
fastify.register(require('fastify-cors'), {
    allowedHeaders: 'Content-Type',
    origin: '*'
});

fastify.post('/time', async (request, reply) => {
    const time = new Date().getTime();

    return { success: true, time};
});

(async () => {
    try {
        await fastify.listen(config.time_server_port, config.time_server_host)
    } catch (err) {
        fastify.log.error(err);
        process.exit(1)
    }
})();
