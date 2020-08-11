#!/usr/bin/env node

const fs = require('fs');
const Web3 = require('web3');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");

const config = require('./config');

const block_filename = `.block_eth_${config.eth.network}`;

const endpoint = `https://${config.eth.network}.infura.io/v3/${config.eth.project_id}`;
const ws_endpoint = `wss://${config.eth.network}.infura.io/ws/v3/${config.eth.project_id}`;

const web3 = new Web3(new Web3.providers.HttpProvider(endpoint));

const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let my_accounts = [];
let sales = {};
const validations = {};


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
};

const get_start_block = async () => {
    try {
        const res = await readfilePromise(block_filename);

        if (res){
            return parseInt(res);
        }
    }
    catch (e){}

    return parseInt(config.eth.default_start_block);
};

const set_start_block = async (block_num) => {
    fs.writeFile(block_filename, block_num, () => {
        console.log(`Block record written at ${block_num}`);
    });
};

const validate_transaction = async (block_num, tx_id) => {
    const tx = await web3.eth.getTransaction(tx_id);
    if (tx && tx.to && my_accounts.includes(tx.to.toLowerCase())){
        console.log(`Validating transaction in block ${block_num}`, tx);
        const balance = await web3.eth.getBalance(tx.to);
        console.log(`balance is ${balance}`);
        const sale = sales[tx.to.toLowerCase()];

        // get sale and check that our balance is > the required amount
        if (sale.price <= balance){
            console.log(`Sale ${sale.sale_id} is fully paid!!  ${sale.native_address} is getting some packs!`, sale);

            send_action(sale, tx_id);
        }
    }
};


const update_accounts = async () => {
    my_accounts = [];
    const res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'sales', limit: 1000});
    res.rows.forEach((row) => {
        if (row.foreign_symbol === 'ETH'){
            const addr = row.foreign_address.toLowerCase();

            my_accounts.push(addr);
            sales[addr] = row;
        }
    });
};

const send_action = async (sale, tx_id) => {
    const actions = [];
    actions.push({
        account: config.contract,
        name: 'payment',
        authorization: [{
            actor: config.contract,
            permission: config.payment_permission,
        }],
        data: {
            sale_id: sale.sale_id,
            tx_id
        }
    });

    // console.log(actions);

    const eos_res = await api.transact({actions}, {
        blocksBehind: 3,
        expireSeconds: 30,
    });

    console.log(`Sent payment to contract ${eos_res.transaction_id}`);
};

const sleep = async (ms) => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

const check = async (block_num = 'latest') => {
    console.log(`Checking block ${block_num}`);
    const block = await web3.eth.getBlock(block_num);
    if (!block || !block.transactions){
        throw "Could not find block"
    }
    block.transactions.forEach(async (tx_id) => {
        const tx = await web3.eth.getTransaction(tx_id);
        // console.log(tx);
        if (tx.to && my_accounts.includes(tx.to.toLowerCase())){
            console.log(`Found in block ${block_num}`, tx);
            const sale = sales[tx.to.toLowerCase()];

            if (typeof sale !== 'undefined'){
                if (typeof validations[block_num] === 'undefined'){
                    validations[block_num] = [];
                }
                validations[block_num].push(tx_id);
            }
        }
    });


    // Check all transactions we need to validate
    for (let bn in validations){
        if (bn <= block_num - config.eth.number_validations){
            console.log(`Sending for validation in ${block_num} ${bn}`);

            const tx_ids = validations[bn];
            delete validations[bn];

            tx_ids.forEach((tx_id) => {
                validate_transaction(bn, tx_id);
            });
        }
    }

    block_num++;
}

const run = async () => {
    let block_num = await get_start_block();

    while (true){
        try {
            await update_accounts();

            await check(block_num);

            if (block_num % 5 === 0 && !Object.keys(validations).length){
                set_start_block(block_num);
            }

            block_num++;
        }
        catch (e){
            await sleep(4000); // wait 7 seconds total for next block
        }

        await sleep(3000);

    }
}


run();
