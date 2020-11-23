#!/usr/bin/env node

process.title = `dcl-server-${process.env.CONFIG}`;

const fetch = require('node-fetch');
const fs = require('fs');
const util = require('ethereumjs-util');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');

const config = require(`../config.${process.env.CONFIG}`);

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


fastify.post('/claim', async (request, reply) => {
    // console.log(request.body);
    let req = request.body;
    if (typeof request.body === 'string'){
        req = JSON.parse(request.body);
    }

    /*req = {
        "wax": "evilmikehere",
        "dcl": "vrlandlord",
        "eth": "0xf0d193d8524ec55fe2f5159aad2ba1a264993605",
        "messageString": "# DCL Signed message\nwax: 2enaw.wam\ndcl: vrlandlord\neth: 0xf0d193d8524ec55fe2f5159aad2ba1a264993605",
        "messageHex": "0x232044434c205369676e6564206d6573736167650a7761783a2032656e61772e77616d0a64636c3a2076726c616e646c6f72640a6574683a20307866306431393364383532346563353566653266353135396161643262613161323634393933363035",
        "signature": "0x018e6bd71d20127902ceeed3c2477447c1c8458a9ee2583c562d1fda24651c730e6ed96a031a2ed52ca2eca6dc9275edfaa4c614963b7da4c7c8e9816ed1a8ae1c"
    };*/

    const message_string = `# DCL Signed message\nwax: ${req.wax}\ndcl: ${req.dcl}\neth: ${req.eth}`;

    const message = Buffer.from(message_string);
    const msgHash = util.hashPersonalMessage(message);
    const sig_params = util.fromRpcSig(req.signature);
    const public_key = util.ecrecover(msgHash, sig_params.v, sig_params.r, sig_params.s);
    const sender = util.publicToAddress(public_key);
    const recovered_address = util.bufferToHex(sender);

    console.log(recovered_address);

    if (recovered_address !== req.eth){
        reply.code(500);
        return {success: false, error: 'Invalid Signature'};
    }

    // Check the dcl name is valid
    const dcl_res = await fetch(`https://peer.decentraland.org/content/entities/profiles?pointer=${recovered_address}`);
    const dcl_json = await dcl_res.json();
    const avatar = dcl_json[0].metadata.avatars[0];
    if (avatar.name !== req.dcl || avatar.ethAddress !== req.eth){
        reply.code(500);
        return {success: false, error: 'Invalid DCL Name'};
    }

    // send out the promo pack

    const actions = [];
    actions.push({
        account: config.contract,
        name: 'redeemdcl',
        authorization: [{
            actor: config.contract,
            permission: config.swap_permission,
        }],
        data: {
            eth_address: req.eth.replace('0x', ''),
            address: req.wax
        }
    });

    let transaction_id;
    try {
        const eos_res = await api.transact({actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        // console.log(eos_res);
        transaction_id = eos_res.transaction_id;
    }
    catch (e){
        reply.code(500);
        return { success: false, error: e.message.replace('assertion failure with message: ', '') };
    }

    return { success: true, transaction_id };
});

(async () => {
    try {
        await fastify.listen(config.dcl_port, config.dcl_host)
    } catch (err) {
        fastify.log.error(err);
        process.exit(1)
    }
})();
