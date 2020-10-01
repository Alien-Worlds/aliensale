#!/usr/bin/env node

const fs = require('fs');
const Web3 = require('web3');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");

const config = require(`../config.${process.env.CONFIG}`);

const block_filename = `.block_eth_${config.eth.network}`;

const endpoint = `https://${config.eth.network}.infura.io/v3/${config.eth.project_id}`;
const ws_endpoint = `wss://${config.eth.network}.infura.io/ws/v3/${config.eth.project_id}`;

const web3 = new Web3(new Web3.providers.HttpProvider(endpoint));

const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let my_accounts = [];
let invoices = {};
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

const validate_transaction = async (block_num, tx) => {
    // const tx = await web3.eth.getTransaction(tx_id);
    if (tx && tx.to && my_accounts.includes(tx.to.toLowerCase())){
        console.log(`Validating transaction in block ${block_num}`, tx);
        // const balance = await web3.eth.getBalance(tx.to);
        const bal_url = `${config.eth.etherscan_endpoint}?module=account&action=balance&address=${tx.to}&tag=latest&apikey=${config.eth.etherscan_api_key}`;
        const bal_res = await fetch(bal_url);
        const bal_json = await bal_res.json();
        console.log(bal_json);
        balance = parseInt(bal_json.result);
        console.log(`balance is ${balance}`);
        const invoice = invoices[tx.to.toLowerCase()];
        console.log(`invoice price ${invoice.price}`);

        // get invoice and check that our balance is > the required amount
        if (invoice.price <= balance){
            console.log(`Invoice ${invoice.invoice_id} is fully paid!!  ${invoice.native_address} is getting some packs!`, invoice);

            send_action(invoice, tx.hash);
        }
    }
};


const update_accounts = async () => {
    my_accounts = [];
    const res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'invoices', limit: 1000});
    res.rows.forEach((row) => {
        if (row.invoice_currency.chain === 'ethereum' && !row.completed){
            const addr = row.foreign_address.toLowerCase();

            my_accounts.push(addr);
            invoices[addr] = row;
        }
    });
    // console.log('Monitoring accounts', invoices)
};

const send_action = async (invoice, tx_id) => {
    const actions = [];
    actions.push({
        account: config.contract,
        name: 'payment',
        authorization: [{
            actor: config.contract,
            permission: config.payment_permission,
        }],
        data: {
            invoice_id: invoice.invoice_id,
            tx_id
        }
    });

    // console.log(actions);

    try {
        const eos_res = await api.transact({actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        console.log(`Sent payment to contract ${eos_res.transaction_id}`);
    }
    catch (e) {
        console.error(e.message);
    }

};

const sleep = async (ms) => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

const check = async () => {
    // get current block
    const time = parseInt(new Date().getTime() / 1000);
    const block_url = `${config.eth.etherscan_endpoint}?module=block&action=getblocknobytime&timestamp=${time}&closest=before&apikey=${config.eth.etherscan_api_key}`;
    const block_res = await fetch(block_url);
    const block_json = await block_res.json();

    if (block_json.status !== '1'){
        console.error(block_json.message);
        return;
    }

    const block_num = block_json.result;
    console.log(`Checking block ${block_num}`);
    // console.log(block_json);

    /* const block = await web3.eth.getBlock(block_num);
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
    }); */

    for (let a=0; a < my_accounts.length; a++) {
        const acnt = my_accounts[a];
        console.log(`Checking ${acnt} at block ${block_num}`);
        const url = `${config.eth.etherscan_endpoint}?module=account&action=txlist&address=${acnt}&startblock=${block_num - 50}&endblock=${block_num}&sort=asc&apikey=${config.eth.etherscan_api_key}`;

        // console.log(url)
        const res = await fetch(url);
        const json = await res.json();

        // console.log(json);

        if (json.result.length) {
            const tx = json.result[0];
            const invoice = invoices[tx.to.toLowerCase()];
            // console.log(tx)

            if (typeof invoice !== 'undefined'){
                if (typeof validations[tx.blockNumber] === 'undefined'){
                    validations[tx.blockNumber] = [];
                }

                const existing = validations[tx.blockNumber].find(_tx => _tx.hash === tx.hash);

                if (!existing){
                    console.log(`Queing transaction ${tx.hash} for validation`);
                    validations[tx.blockNumber].push(tx);
                }
                else {
                    console.log(`${tx.hash} already queued for validation`)
                }
            }
        }

        await sleep(50);
    }


    // Check all transactions we need to validate
    for (let bn in validations){
        if (bn <= block_num - config.eth.number_validations){
            console.log(`Sending for validation in ${block_num} ${bn}`);

            const txs = validations[bn];
            delete validations[bn];

            txs.forEach((tx) => {
                validate_transaction(bn, tx);
            });
        }
    }

    // block_num++;
}

const run = async () => {
    while (true){
        try {
            await update_accounts();

            await check();
        }
        catch (e){
            console.error(e.message)
            await sleep(4000);
        }

        await sleep(12000);

    }
}


run();
