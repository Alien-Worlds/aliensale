#!/usr/bin/env node

process.title = 'eth-redeem';

const fetch = require('node-fetch');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const Web3 = require('web3');
const util = require('ethereumjs-util');

const config = require('../config');
const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });


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

fastify.post('/redeem', async (request, reply) => {
    const req = JSON.parse(request.body);
    const res = await rpc.get_table_rows({
        code: 'sale.worlds',
        scope: 'sale.worlds',
        table: 'ethswaps',
        lower_bound: req.id,
        upper_bound: req.id,
        limit: 1
    });

    if (!res.rows.length){
        console.log(`Invalid ID supplied`);
        reply.code(500);
        return {success: false, error: 'Invalid ID'};
    }
    console.log(`Verifying signature`, req)
    let transaction_id;

    try {
        var data = 'evilmikehere';
        var message = Buffer.from(data);
        var msgHash = util.hashPersonalMessage(message);
        var sig_params = util.fromRpcSig(req.signature);
        var public_key = util.ecrecover(msgHash, sig_params.v, sig_params.r, sig_params.s);
        var sender = util.publicToAddress(public_key);
        var recovered_address = util.bufferToHex(sender);

        // console.log(res.rows[0]);
        const eth_address = `0x${res.rows[0].eth_address}`;

        if (recovered_address !== eth_address){
            reply.code(500);
            return {success: false, error: 'Invalid Signature'};
        }

        console.log(`RECOVERED`, recovered_address);

        const actions = [];
        actions.push({
            account: config.contract,
            name: 'redeemswap',
            authorization: [{
                actor: config.contract,
                permission: config.swap_permission,
            }],
            data: {
                ethswap_id: req.id,
                eth_address: res.rows[0].eth_address,
                address: req.account
            }
        });

        const eos_res = await api.transact({actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        // console.log(eos_res);
        transaction_id = eos_res.transaction_id;
    }
    catch (e){
        console.error(e.message);
        return {success: false, error: e.message.replace('assertion failure with message: ', '')}
    }

    return {success:true, transaction_id}
});

(async () => {
    try {
        await fastify.listen(process.env.SERVER_PORT, process.env.SERVER_ADDR)
    } catch (err) {
        fastify.log.error(err);
        process.exit(1)
    }
})();
