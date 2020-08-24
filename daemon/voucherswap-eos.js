#!/usr/bin/env node

/*
Monitors a foreign chain for transfers to the burn address and then issues a pack on the native chain

User should send the voucher to voucher_burn_address with the receiving address as the memo
 */

const fs = require('fs');
const StateReceiver = require('@eosdacio/eosio-statereceiver');
const fetch = require('node-fetch');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');

const config = require('../config');

const block_filename = `.voucherswap_eos_${config.eos.chainId}`;

const rpc = new JsonRpc(config.endpoint, {fetch});
const foreign_rpc = new JsonRpc(config.eos.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });
const foreign_api = new Api({ rpc: foreign_rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });



let my_accounts = [];
let sales = {};
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

    return config.eos.default_start_block;
};

const set_start_block = async (block_num) => {
    fs.writeFile(block_filename, block_num, () => {
        console.log(`Block record written at ${block_num}`);
    });
};

const is_valid_name = (name) => {
    const sb = new Serialize.SerialBuffer({
        textEncoder: new TextEncoder,
        textDecoder: new TextDecoder
    });

    try {
        sb.pushName(name);
        const read = sb.getName();

        return (read === name && read !== '');
    }
    catch (e){
        return false;
    }
};

const send_action = async (buyer, quantity, tx_id) => {
    const actions = [];
    actions.push({
        account: config.contract,
        name: 'swap',
        authorization: [{
            actor: config.contract,
            permission: config.swap_permission,
        }],
        data: {
            buyer,
            quantity,
            tx_id
        }
    });

    // console.log(actions);

    try {
        const eos_res = await api.transact({actions}, {
            blocksBehind: 3,
            expireSeconds: 30,
        });

        console.log(`Sent swap to contract ${eos_res.transaction_id}`);
    }
    catch (e){
        console.log(e.message);
    }

};

class TraceHandler {
    constructor({config}) {
        this.config = config;
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
                                const act = action[1].act;
                                if (act.account === this.config.eos.voucher_token_contract
                                    && act.name === 'transfer'
                                    && action[1].receiver === this.config.eos.voucher_token_contract){

                                    // received transfer to burn address
                                    const action_deser = await foreign_api.deserializeActions([act]);
                                    if (action_deser[0].data.to === this.config.eos.voucher_burn_address){
                                        const native_address = action_deser[0].data.memo;
                                        const quantity = action_deser[0].data.quantity;

                                        console.log(`Received transfer to swap token`, trx.id);

                                        if (is_valid_name(native_address)){
                                            console.log(`Memo is valid`);

                                            send_action(native_address, quantity, trx.id);
                                        }
                                        else {
                                            console.error(`Transfer memo invalid! ${native_address}`);
                                        }
                                    }

                                }
                                break;
                        }
                    }
                    break;
            }

        }


        // update last received block but only if we dont have pending validations
        if (block_num % 10 === 0){
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
            sr.restart(current_block, 0xffffffff);
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
    const start_block = await get_start_block();

    console.log(`Starting at block ${start_block}`);

    start(start_block);
}

run();
