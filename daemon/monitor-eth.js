#!/usr/bin/env node

process.title = `monitor-eth-${process.env.CONFIG}`;

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
let invoices = {}, preorders = {};
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
        // console.log(bal_json);
        balance = parseInt(bal_json.result);
        // balance = tx.balance;
        console.log(`balance is ${balance}`);

        if (typeof invoices[tx.to.toLowerCase()] !== 'undefined'){
            const invoice = invoices[tx.to.toLowerCase()];
            console.log(`invoice price ${invoice.price}`);

            // get invoice and check that our balance is > the required amount
            if (invoice.price <= balance){
                console.log(`Invoice ${invoice.invoice_id} is fully paid!!  ${invoice.native_address} is getting some packs!`, invoice);

                send_action(invoice, tx.hash);
            }
        }
        else if (typeof preorders[tx.to.toLowerCase()] !== 'undefined'){
            const preorder = preorders[tx.to.toLowerCase()];
            const [expected_str] = preorder.quantity.split(' ');
            const expected_float = parseFloat(expected_str);
            const balance_float = balance / Math.pow(10, 18);

            // console.log(preorder, expected_float, balance_float);

            if (expected_float <= balance_float || expected_float.toFixed(6) === balance_float.toFixed(6)){
                console.log(`Balance received for preorder`);
                send_preorder_action(preorder, tx.hash);
            }
        }

    }
};


const update_accounts = async () => {
    my_accounts = [];
    console.log(`Update accounts`);
    let first_run = true;
    let res = {rows:[]};
    let lower_bound = 0;
    while (res.rows.length || first_run){
        res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'invoices', limit: 100, lower_bound});

        res.rows.forEach((row) => {
            if (row.invoice_currency.chain === 'ethereum' && !row.completed){
                const addr = row.foreign_address.toLowerCase();
                my_accounts.push(addr);
                invoices[addr] = row;
            }
            lower_bound = row.invoice_id + 1;
        });

        first_run = false;
    }


    console.log(`Update preorder accounts`);
    first_run = true;
    res = {rows:[]};
    lower_bound = 0;
    while (res.rows.length || first_run){
        res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'preorders', limit: 100, lower_bound});

        res.rows.forEach((row) => {
            if (row.quantity.substr(-3) === 'ETH' && !row.paid){
                const addr = row.foreign_address.toLowerCase();
                my_accounts.push(addr);
                preorders[addr] = row;
            }
            lower_bound = row.preorder_id + 1;
        });

        first_run = false;
    }
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



const send_preorder_action = async (preorder, tx_id) => {
    const actions = [];
    actions.push({
        account: config.contract,
        name: 'paymentpre',
        authorization: [{
            actor: config.contract,
            permission: config.payment_permission,
        }],
        data: {
            preorder_id: preorder.preorder_id,
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

    const m = 20;
    let my_accounts_copy = my_accounts;
    while (my_accounts_copy.length) {
        const acnts = my_accounts_copy.slice(0, m);
        my_accounts_copy = my_accounts_copy.slice(m);

        const acnts_str = acnts.join(',');
        console.log(`Checking ${acnts_str} at block ${block_num}`);
        const url = `${config.eth.etherscan_endpoint}?module=account&action=balancemulti&address=${acnts_str}&tag=latest&apikey=${config.eth.etherscan_api_key}`;

        // console.log(url)
        const res = await fetch(url);
        const json = await res.json();

        // console.log(config.eth.etherscan_endpoint);

        if (json.result.length) {
            const with_balance = json.result.filter(r => r.balance !== '0');
            // console.log(with_balance);
            // return;

            for (let r = 0; r < with_balance.length; r++){
                const {account, balance} = with_balance[r];
                const url = `${config.eth.etherscan_endpoint}?module=account&action=txlist&address=${account.toLowerCase()}&startblock=${block_num - 5000}&endblock=${block_num}&sort=asc&apikey=${config.eth.etherscan_api_key}`;
                const res = await fetch(url);
                const json = await res.json();

                // console.log(json);
                if (json.message === 'NOTOK'){
                    console.error(`Failed to get transactions for ${account}`, json);
                    continue;
                }
                if (json.status === '0'){
                    continue;
                }

                const tx = json.result[0];

                if (!tx || !tx.to){
                    console.error(`Transaction didnt contain "to"`, json);
                    continue;
                }
                const invoice = invoices[tx.to.toLowerCase()];
                const preorder = preorders[tx.to.toLowerCase()];
                // console.log(tx)

                if (typeof invoice !== 'undefined' || typeof preorder !== 'undefined'){
                    tx.balance = balance;

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
        }

        await sleep(120);
    }


    // Check all transactions we need to validate
    for (let bn in validations){
        if (bn <= block_num - config.eth.number_validations){
            console.log(`Sending for validation in ${block_num} ${bn}`);

            const txs = validations[bn];
            delete validations[bn];
            // console.log(txs);

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

        await sleep(120000);

    }
}


run();
