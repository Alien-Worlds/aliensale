#!/usr/bin/env node

const fs = require('fs');
const csv = require('csv-parser');
const readline = require('readline');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");
const {transactCleos} = require('./transact_cleos');

const pack_contract = 'pack.worlds';
const sale_contract = 'sale.worlds';
const collection_name = 'alien.worlds';
const endpoint = 'https://testnet.waxsweden.org';
const aa_endpoint = 'https://test.wax.api.atomicassets.io';
const CLEOS = '/home/mike/Projects/EOS/wax-testnet.sh';
const csv_filename = 'ethereum_airdrop.csv';


const rpc = new JsonRpc(endpoint, {fetch});
const signatureProvider = null;
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });


const send_tx = async (actions) => {
    try {
        const res_create = await transactCleos({
            actions
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
            broadcast: false,
            sign: false
        }, [sale_contract], CLEOS, api);

        return res_create;
    }
    catch (e){
        throw e;
    }
}

const import_file = async (count) => {
    const quantity = '1 DACPRO';
    let actions = [];

    const readInterface = readline.createInterface({
        input: fs.createReadStream(csv_filename),
        console: false
    });
    readInterface.on('line', (raw_eth) => {
        // console.log(raw_eth);
        if (raw_eth.substr(0, 2) !== '0x' || raw_eth.length !== 42){
            console.error(`Invalid ETH address ${raw_eth}`);
        }
        else {
            const eth_address = raw_eth.substr(2).toLowerCase();
            // console.log(`${raw_eth} => ${eth_address}`);
            actions.push({
                account: sale_contract,
                name: 'addethswap',
                authorization: [{
                    actor: sale_contract,
                    permission: 'active',
                }],
                data: {
                    eth_address,
                    quantity
                }
            });

            if (actions.length >= count){
                const res = send_tx(actions);
                res.then((res) => {
                    console.log(`Pushed actions with tx id ${res.transaction_id}`);
                }).catch(e => {
                    console.error(`Failed to push addresses ${e.message}`);
                });
                actions = [];
            }
        }
    });

};


let count = 20;
if (process.argv[2]){
    count_num = parseInt(process.argv[2]);
    if (!isNaN(count_num)){
        count = count_num;
    }
}

import_file(count);
