#!/usr/bin/env node

/*
Consolodates all the received ether into a single account specified in the config file
 */

const Web3 = require('web3');
const Tx = require('ethereumjs-tx').Transaction;
const fs = require('fs');
const HDKey = require('hdkey');
const ethUtil = require('ethereumjs-util');

const config = require(`../config.${process.env.CONFIG}`);

const endpoint = `https://${config.eth.network}.infura.io/v3/${config.eth.project_id}`;
const ws_endpoint = `wss://${config.eth.network}.infura.io/ws/v3/${config.eth.project_id}`;

const web3 = new Web3(new Web3.providers.HttpProvider(endpoint));


/*
Consolidates all eth balances into a single account specified in the config
*/


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

const sendTx = async (tx, pk) => {
    return new Promise((resolve, reject) => {
        web3.eth.accounts.signTransaction(tx, pk).then(signed => {
            console.log(`Sending txid ${signed.transactionHash}`)
            web3.eth.sendSignedTransaction(signed.rawTransaction, (err, receipt) => {
                if (err){
                    // console.error(`Transaction error`, err);
                    reject(err);
                }
                else {
                    // console.log(`Transaction sent ${receipt.transactionHash}`);
                    resolve(receipt);
                }
            });
        });
    });
}

const sleep = async (ms) => {
    return new Promise(resolve => {
        setTimeout(resolve, ms);
    });
};

const start = async (dry_run) => {
    if (dry_run){
        console.log(`Processing dry run, tokens will not be sent`);
    }

    const data = await readfilePromise('keys.txt');

    const [mnemonic, seed] = data.toString().split(`\n`);

    const hdkey = HDKey.fromMasterSeed(Buffer.from(seed, 'hex'));

    let x = 0;

    const consolidate_address = config.eth.consolidate;

    while (x < 500) {
        const addrNode = hdkey.derive(`m/44'/60'/0'/0/${x}`);
        const pubKey = ethUtil.privateToPublic(addrNode.privateKey);
        const addr = ethUtil.publicToAddress(pubKey).toString('hex');
        const pk = ethUtil.toChecksumAddress(`0x${addrNode.privateKey.toString('hex')}`);
        const address = ethUtil.toChecksumAddress(`0x${addr}`);

        const gas = 21000n;
        const gas_price = 40n * 1000000000n;  // 10 gwei
        const balance = BigInt(await web3.eth.getBalance(address));

        const total_to_send = balance - gas * gas_price;


        if (total_to_send > 0 && address.toLowerCase() !== consolidate_address.toLowerCase()){
            console.log(`sending Ξ${web3.utils.fromWei(total_to_send.toString())} from ${address} to ${consolidate_address} (balance is ${web3.utils.fromWei(balance.toString())})`);

            const tx = {
                from: address,
                to: consolidate_address,
                value: '0x' + total_to_send.toString(16),
                gas: '0x' + gas.toString(16),
                gasPrice: '0x' + gas_price.toString(16)
            };

            if (!dry_run){
                try {
                    const receipt = await sendTx(tx, pk);
                    console.log(`TXID : ${receipt}`);
                    await sleep(500);
                    // process.exit(0)
                }
                catch (e){
                    console.error(e.message)
                }
            }
        }

        x++;

    }

}

let dry_run = false;
for (let x=0;x<process.argv.length;x++){
    if (process.argv[x] === '--dry-run'){
        dry_run = true;
    }
}

start(dry_run);
