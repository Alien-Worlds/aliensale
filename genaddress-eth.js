#!/usr/bin/env node

/*
Generates 500 addresses from the key data in keys.txt, then sends them to the contract
 */

const fs = require('fs');
const HDKey = require('hdkey');
const ethUtil = require('ethereumjs-util');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");

const config = require('./config');


const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });




const submit_addresses = async (addresses) => {
    const actions = [];

    addresses.forEach((ad) => {
        actions.push({
            account: config.contract,
            name: 'addaddress',
            authorization: [{
                actor: config.contract,
                permission: config.populate_permission,
            }],
            data: {
                address_id: ad.id,
                foreign_chain: 'eth',
                address: ad.address
            }
        });
    });

    await api.transact({actions}, {
        blocksBehind: 3,
        expireSeconds: 30,
    });
}


const readfilePromise = async (filename) => {
    return new Promise((resolve, reject) => {
        fs.readFile(filename, (err, data) => {
            if (err){
                reject(err);
            }
            else {
                resolve(data);
            }
        });
    });
}


const start = async () => {
    const data = await readfilePromise('keys.txt');

    const [mnemonic, seed] = data.toString().split(`\n`);

    const hdkey = HDKey.fromMasterSeed(Buffer.from(seed, 'hex'));

    let x = 0;
    let populate_data = [];

    while (x < 500) {
        const addrNode = hdkey.derive(`m/44'/60'/0'/0/${x}`);
        const pubKey = ethUtil.privateToPublic(addrNode.privateKey);
        const addr = ethUtil.publicToAddress(pubKey).toString('hex');
        const pk = ethUtil.toChecksumAddress(`0x${addrNode.privateKey.toString('hex')}`);
        const address = ethUtil.toChecksumAddress(`0x${addr}`);

        // console.log(`Private ${x}: ${pk}`);
        // console.log(`Public ${x}: ${address}`);

        populate_data.push(
            {id: x, address}
        );

        if ((x % 20) === 0 && x > 0){
            // submit to chain
            try {
                await submit_addresses(populate_data);
            }
            catch (e){
                console.log(`${x} failed ${e.message}`);
            }


            // console.log('submitting', populate_data);
            // process.exit(0);

            populate_data = [];
        }

        x++;
    }


    if (populate_data.length){
        await submit_addresses(populate_data);
    }

}

start();
