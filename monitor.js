const Web3 = require('web3');
const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");

const config = require('./config');

const endpoint = `https://${config.network}.infura.io/v3/${config.project_id}`;
const ws_endpoint = `wss://${config.network}.infura.io/ws/v3/${config.project_id}`;

const web3 = new Web3(new Web3.providers.HttpProvider(endpoint));

const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

let my_accounts = [];
let sales = {};

const update_accounts = async () => {
    my_accounts = [];
    const res = await rpc.get_table_rows({json: true, code: config.contract, scope: config.contract, table: 'sales', limit: 1000});
    res.rows.forEach((row) => {
        const addr = row.foreign_address.toLowerCase();

        my_accounts.push(addr);
        sales[addr] = row;
    });
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
    block.transactions.forEach(async tx_id => {
        const tx = await web3.eth.getTransaction(tx_id);
        // console.log(tx);
        if (tx.to && my_accounts.includes(tx.to.toLowerCase())){
            console.log(`Found in block ${block_num}`, tx);
            const balance = await web3.eth.getBalance(tx.to);
            console.log(`balance is ${balance}`);
            const sale = sales[tx.to.toLowerCase()];

            // get sale and check that our balance is > the required amount
            if (sale.price <= balance){
                console.log(`Sale ${sale.sale_id} is fully paid!!  ${sale.native_address} is getting some packs!`, sale);

                const actions = [];
                sale.items.forEach((item) => {
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
                });

                console.log(actions);

                const eos_res = await api.transact({actions}, {
                    blocksBehind: 3,
                    expireSeconds: 30,
                });

                console.log(`Sent payment to contract ${eos_res.transaction_id}`);
            }
        }
    });
}

const run = async () => {
    let block_num = 8452601;


    while (true){
        try {
            await update_accounts();

            await check(block_num);


            block_num++;
        }
        catch (e){
            await sleep(4000); // wait 7 seconds total for next block
        }

        await sleep(3000);

    }
}


run();
