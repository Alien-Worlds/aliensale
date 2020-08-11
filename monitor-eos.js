#!/usr/bin/env node

const fs = require('fs');
const StateReceiver = require('@eosdacio/eosio-statereceiver');
const fetch = require('node-fetch');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');

const config = require('./config');

const block_filename = `.block_eos_${config.eos.chainId}`;

const rpc = new JsonRpc(config.endpoint, {fetch});
const foreign_rpc = new JsonRpc(config.eos.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let my_accounts = [];
let sales = {};
const validations = {}; // block_num : transaction ids to validate and send payment action after 10 blocks


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
            return res;
        }
    }
    catch (e){}

    return config.eos.default_start_block;
};

const set_start_block = async (block_num) => {
    fs.writeFile(block_filename, block_num, () => {
        console.log(`Block record written at ${block_num}`);
    });
};

const update_accounts = async () => {
    my_accounts = [];
    const res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'sales', limit: 1000});
    res.rows.forEach((row) => {
        if (row.foreign_symbol === 'EOS'){
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

const validate_transaction = async (block_num, transaction_id) => {
    delete validations[block_num];
    console.log(`Validating ${transaction_id} from block ${block_num}`);
    const trx = await foreign_rpc.history_get_transaction(transaction_id, block_num);
    console.log(trx.trx.trx.actions);
    trx.trx.trx.actions.forEach((act) => {
        if (act.account === 'eosio.token' && act.name === 'transfer' && act.data.to === config.eos.receive_address){
            const sale = sales[act.data.memo];
            if (typeof sale !== 'undefined'){
                const [amount_str, sym] = act.data.quantity.split(' ');
                const amount = parseFloat(amount_str);

                const required = sale.price / Math.pow(10, 4);

                if (required <= amount){
                    console.log(`${sale.native_address} has paid for sale ${sale.sale_id}!`);

                    send_action(sale, transaction_id.toLowerCase());
                }
            }
        }
    });
    // process.exit(0)

    /*const [amount_str, sym] = quantity.split(' ');
    const amount = parseFloat(amount_str);

    const required = sale.price / Math.pow(10, 4);

    if (required <= amount){
        console.log(`${sale.native_address} has paid for sale ${sale.sale_id}!`);

        send_action(sale, trx.id.toLowerCase());
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
                                if (action[1].act.account === 'eosio.token' && action[1].act.name === 'transfer' && action[1].receiver === this.config.eos.receive_address){
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

                                        const sale = sales[memo.toLowerCase()];

                                        if (typeof sale !== 'undefined'){
                                            console.log(`Found sale `, sale);

                                            // save to validations to check after 20 blocks
                                            validations[block_num] = trx.id.toLowerCase();


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
            if (bn <= block_num - config.number_validations){
                console.log(`Sending for validation in ${block_num} ${bn}`);
                validate_transaction(bn, validations[bn]);
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
}

const run = async () => {
    const start_block = await get_start_block();

    console.log(`Starting at block ${start_block}`);

    start(start_block);
}

run();
