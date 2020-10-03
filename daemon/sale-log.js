#!/usr/bin/env node

process.title = `sale-log-${process.env.CONFIG}`;

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

fastify.post('/sale', async (request, reply) => {
    // console.log(request.body);
    let req = request.body;
    if (typeof request.body === 'string'){
        req = JSON.parse(request.body);
    }
    // console.log(req);
    if (!req || !req.txId || !req.country) {
        throw new Error('You must supply txId and country as part of the post JSON');
    }
    req.txId = req.txId.toLowerCase();
    // check txId is hex
    const ret = /^[a-z0-9]{64}$/;
    const hexTest = ret.test(req.txId);
    // console.log(hexTest)
    if (!hexTest){
        throw new Error('Transaction ID is in the wrong format');
    }
    const rec = /^[A-Z]{2}$/;
    if (!rec.test(req.country) || req.country.length !== 2){
        throw new Error('Country in wrong format');
    }
    fs.writeFileSync(`receipts/${req.txId}.txt`, req.country);
    return { success: true };
});

(async () => {
    try {
        await fastify.listen(config.sale_server_port, config.sale_server_host)
    } catch (err) {
        fastify.log.error(err);
        process.exit(1)
    }
})();
