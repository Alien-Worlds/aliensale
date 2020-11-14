#!/usr/bin/env node

process.title = `monitor-eos-${process.env.CONFIG}`;

const fs = require('fs');
const StateReceiver = require('@eosdacio/eosio-statereceiver');
const fetch = require('node-fetch');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');

const config = require(`../config.${process.env.CONFIG}`);

const block_filename = `.block_eos_${config.eos.chainId}`;

const rpc = new JsonRpc(config.endpoint, {fetch});
const foreign_rpc = new JsonRpc(config.eos.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let my_accounts = [];
let invoices = {};
let preorders = {};
const validations = {}; // block_num : transaction ids to validate and send payment action after 10 blocks
let sr;
let watchdog_last_block = 0;

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

    const info = await foreign_rpc.get_info();
    console.log(info);
    return info.last_irreversible_block_num;
};

const set_start_block = async (block_num) => {
    fs.writeFile(block_filename, block_num, () => {
        console.log(`Block record written at ${block_num}`);
    });
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
            if (row.invoice_currency.chain === 'eos' && !row.completed){
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
            if (row.quantity.substr(-6) === 'EOSDAC' && !row.paid){
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

    const eos_res = await api.transact({actions}, {
        blocksBehind: 3,
        expireSeconds: 30,
    });

    console.log(`Sent payment to contract ${eos_res.transaction_id}`);
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


const validate_transaction = async (block_num, transaction_id) => {
    console.log(`Validating ${transaction_id} from block ${block_num}`);
    const trx = await foreign_rpc.history_get_transaction(transaction_id, block_num);
    // console.log(trx.trx.trx.actions);
    for (let a = 0; a < trx.trx.trx.actions.length; a++){
        const act = trx.trx.trx.actions[a];

        if (act.name === 'transfer' && act.data.to === config.eos.receive_address){
            const invoice = invoices[act.data.memo];
            if (typeof invoice !== 'undefined'){
                console.log(`Found invoice!!`, invoice);

                const [amount_str, sym] = act.data.quantity.split(' ');
                const amount = parseFloat(amount_str);
                const [required_precision_str, required_symbol] = invoice.invoice_currency.symbol.split(',');
                const required_precision = parseInt(required_precision_str);
                if (required_symbol !== sym){
                    console.error(`Symbol does not match required`, required_symbol, sym);
                    return;
                }
                if (invoice.invoice_currency.contract != act.account){
                    console.error(`Wrong contract ${act.account} != ${invoice.invoice_currency.contract}`);
                    return;
                }

                const required = invoice.price / Math.pow(10, required_precision);

                if (required <= amount){
                    console.log(`${invoice.native_address} has paid for invoice ${invoice.invoice_id}!`);

                    send_action(invoice, transaction_id.toLowerCase());
                }
            }
            else {
                const preorder = preorders[act.data.memo];
                if (typeof preorder !== 'undefined'){
                    console.log(`Found preorder!!`, preorder);

                    // get the auction
                    const auction_res = await rpc.get_table_rows({
                        json: true,
                        code: config.contract,
                        scope: config.contract,
                        table: 'auctions',
                        limit: 1,
                        lower_bound: preorder.auction_id,
                        upper_bound: preorder.auction_id
                    });

                    if (auction_res.rows.length){
                        const auction = auction_res.rows[0];
                        // console.log(auction);
                        const [amount_str, sym] = act.data.quantity.split(' ');
                        const amount = parseFloat(amount_str);
                        const [required_precision_str, required_symbol] = auction.price_symbol.symbol.split(',');
                        const required_precision = parseInt(required_precision_str);
                        if (required_symbol !== sym){
                            console.error(`Symbol does not match required`, required_symbol, sym);
                            continue;
                        }
                        if (auction.price_symbol.contract != act.account){
                            console.error(`Wrong contract ${act.account} != ${auction.price_symbol.contract}`);
                            continue;
                        }

                        const [required_amount_str] = preorder.quantity.split(' ');
                        const required = parseFloat(required_amount_str);

                        if (required <= amount){
                            console.log(`${preorder.account} has paid for preorder ${preorder.preorder_id}!`);

                            send_preorder_action(preorder, transaction_id.toLowerCase());
                        }
                    }
                    else {
                        console.error(`Could not find auction`);
                    }
                }
            }
        }
    }
    // process.exit(0)

    /*const [amount_str, sym] = quantity.split(' ');
    const amount = parseFloat(amount_str);

    const required = invoice.price / Math.pow(10, 4);

    if (required <= amount){
        console.log(`${invoice.native_address} has paid for invoice ${invoice.invoice_id}!`);

        send_action(invoice, trx.id.toLowerCase());
    }*/
}


class TraceHandler {
    constructor({config}) {
        this.config = config;

        /*const rpc = new JsonRpc(this.config.eos.endpoint, {fetch});
        this.api = new Api({
            rpc,
            signatureProvider: null,
            chainId: this.config.chainId,
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
        });*/
    }


    async queueTrace(block_num, traces, block_timestamp) {

        for (const trace of traces) {
            switch (trace[0]) {
                case 'transaction_trace_v0':
                    const trx = trace[1];
                    // console.log(trx)
                    for (let action of trx.action_traces) {
                        //console.log(action)
                        switch (action[0]) {
                            case 'action_trace_v0':
                                if (action[1].act.name === 'transfer' && action[1].receiver === this.config.eos.receive_address){
                                    // console.log(block_num, action[1], trx.id, block_timestamp);
                                    const sb = new Serialize.SerialBuffer({
                                        textEncoder: new TextEncoder,
                                        textDecoder: new TextDecoder,
                                        array: action[1].act.data
                                    });

                                    const from = sb.getName();
                                    const to = sb.getName();
                                    const quantity = sb.getAsset();
                                    const memo = sb.getString();
                                    if (to === this.config.eos.receive_address){
                                        console.log(`Received transfer from ${from} in block ${block_num}`);
                                        console.log(from, to, quantity, memo);
                                        await update_accounts();

                                        const invoice = invoices[memo.toLowerCase()];

                                        if (typeof invoice !== 'undefined'){
                                            console.log(`Found invoice `, invoice);

                                            // save to validations to check after 20 blocks
                                            if (typeof validations[block_num] === 'undefined'){
                                                validations[block_num] = [];
                                            }
                                            validations[block_num].push(trx.id.toLowerCase());

                                        }
                                        else {
                                            console.log(`Checking preorders`, preorders);
                                            const preorder = preorders[memo.toLowerCase()];

                                            if (typeof preorder !== 'undefined'){
                                                console.log(`Found preorder `, preorder);

                                                // save to validations to check after 20 blocks
                                                if (typeof validations[block_num] === 'undefined'){
                                                    validations[block_num] = [];
                                                }
                                                validations[block_num].push(trx.id.toLowerCase());
                                            }
                                        }
                                    }

                                }
                                break;
                        }
                    }
                    break;
            }

        }

        // Check all transactions we need to validate
        for (let bn in validations){
            if (bn <= block_num - config.eos.number_validations){
                console.log(`Sending for validation in ${block_num} ${bn}`);
                const tx_ids = validations[bn];
                delete validations[bn];

                tx_ids.forEach((tx_id) => {
                    validate_transaction(bn, tx_id);
                });

            }
        }

        // update last received block but only if we dont have pending validations
        if (!Object.keys(validations).length && block_num % 10 === 0){
            set_start_block(block_num);
        }
    }

    async processTrace(block_num, traces, block_timestamp) {
        // console.log(`Process block ${block_num}`)
        return this.queueTrace(block_num, traces, block_timestamp);
    }

}


const watchdog = () => {
    console.log('Watchdog check...');
    // Checks if new blocks have been received and then restarts state receiver if not updated
    get_start_block().then(current_block => {
        if (current_block === watchdog_last_block && watchdog_last_block > 0) {
            console.log(`Block not increasing, restarting state receiver`);
            sr.current_block = -1;
            sr.restart(current_block, 0xffffffff);
            watchdog_last_block = 0;
        }
        else {
            console.log(`Blocks being received ${current_block} > ${watchdog_last_block}`);
            watchdog_last_block = current_block;
        }
    });
}

const start = async (start_block) => {

    const delta_handler = new TraceHandler({config});

    sr = new StateReceiver({
        startBlock: start_block,
        endBlock: 0xffffffff,
        mode: 0,
        config
    });
    sr.registerTraceHandler(delta_handler);
    sr.start();

    setInterval(watchdog, 15000);
}

const run = async () => {
    let start_block = 0;
    if (process.argv[2]){
        const block_num = parseInt(process.argv[2]);
        if (!isNaN(block_num)){
            start_block = block_num;
        }
    }
    if (start_block == 0){
        start_block = await get_start_block();
    }

    console.log(`Starting at block ${start_block}`);

    start(start_block);
}

run();
