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


const start = async () => {
    const data = await readfilePromise('keys.txt');

    const [mnemonic, seed] = data.toString().split(`\n`);

    const hdkey = HDKey.fromMasterSeed(Buffer.from(seed, 'hex'));

    let x = 0, total = 0;

    const consolidate_address = config.eth.consolidate;

    while (x < 500) {
        const addrNode = hdkey.derive(`m/44'/60'/0'/0/${x}`);
        const pubKey = ethUtil.privateToPublic(addrNode.privateKey);
        const addr = ethUtil.publicToAddress(pubKey).toString('hex');
        const pk = ethUtil.toChecksumAddress(`0x${addrNode.privateKey.toString('hex')}`);
        const address = ethUtil.toChecksumAddress(`0x${addr}`);

        const balance = await web3.eth.getBalance(address);
        const etherBalance = web3.utils.fromWei(balance);

        if (etherBalance > 0){
            console.log(`${address} = ${etherBalance}`);
            total += parseFloat(etherBalance);
        }

        x++;

    }

    console.log(`TOTAL ${total}`)
}

start();
