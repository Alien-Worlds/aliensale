#!/usr/bin/env node

/*
Processes all the preorders at the beginning of a period
 */

process.title = `process-preorders-${process.env.CONFIG}`;

const { Api, JsonRpc, Serialize } = require('eosjs');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');
const { TextDecoder, TextEncoder } = require('text-encoding');
const fetch = require("node-fetch");

const config = require(`../config.${process.env.CONFIG}`);


const rpc = new JsonRpc(config.endpoint, {fetch});
const signatureProvider = new JsSignatureProvider([config.private_key]);
const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });


let auctions;
let reload_auctions_timer;

const parseDate = (fullStr) => {
    const [fullDate] = fullStr.split('.')
    const [dateStr, timeStr] = fullDate.split('T')
    const [year, month, day] = dateStr.split('-')
    const [hourStr, minuteStr, secondStr] = timeStr.split(':')

    const dt = new Date()
    dt.setUTCFullYear(year)
    dt.setUTCMonth(month - 1)
    dt.setUTCDate(day)
    dt.setUTCHours(hourStr)
    dt.setUTCMinutes(minuteStr)
    dt.setUTCSeconds(secondStr)

    return dt.getTime()
}

const get_period_times = async (auction_data) => {
    console.log(`Getting auction data for ${auction_data.auction_id}`);

    const now = parseInt(Date.now() / 1000);
    const start_time = parseInt(parseDate(auction_data.start_time) / 1000);
    const cycle_length = auction_data.period_length + auction_data.break_length;

    const period_times = [];
    period_times[0] = {period: 0, start_time};
    let p = 1;
    while (p < auction_data.period_count){
        period_times[p] = {period: p, start_time: start_time + (p * cycle_length)};
        p++;
    }

    // console.log(period_times.filter(p => p.start_time >= now))
    return period_times.filter(p => p.start_time >= now);
}


const get_auctions = async () => {
    const res = await rpc.get_table_rows({
        code: config.contract,
        scope: config.contract,
        table: 'auctions'
    });

    if (!res.rows.length){
        throw new Error(`Could not get auctions`);
    }

    const auctions = [];

    for (let a = 0; a < res.rows.length; a++){
        const auction_data = res.rows[a];

        const periods = await get_period_times(auction_data);

        if (periods.length){
            auction_data.periods = periods;
            auctions.push(auction_data);
        }
        // console.log(auction_data, periods);
    }

    reload_auctions_timer = null

    return auctions;
}

const check_auctions = async () => {
    const now = parseInt(Date.now() / 1000);
    for (let a = 0; a < auctions.length; a++){
        const to_check = auctions[a].periods.filter(p => (p.start_time - 3) <= now);
        if (to_check.length){
            for (let c = 0; c < to_check.length; c++){
                const check = to_check[c];

                console.log(`CHECKING AUCTION ${auctions[a].auction_id}`, check);

                const actions = [{
                    account: config.contract,
                    name: 'processpre',
                    authorization: [{
                        actor: config.contract,
                        permission: 'process',
                    }],
                    data: {
                        auction_id: auctions[a].auction_id,
                        auction_period: check.period,
                        loop_count: 50
                    }
                }];

                // console.log(actions);

                try {
                    const api_resp = await api.transact({actions}, {
                        blocksBehind: 3,
                        expireSeconds: 30
                    });

                    console.log('Auction success', api_resp.transaction_id);
                }
                catch (e){
                    if (e.message.indexOf('started yet') < 0){
                        console.log('Auction check', e.message.replace('assertion failure with message: ', ''));
                    }
                    if (e.message.indexOf('No preorders found for this auction period') > -1){
                        auctions = await get_auctions();
                    }
                }
            }

            if (!reload_auctions_timer) {
                reload_auctions_timer = setTimeout(async () => {
                    auctions = await get_auctions();
                }, 20000);
            }
        }
    }
}

const check_preorders = async () => {
    const res = await rpc.get_table_rows({
        code: config.contract,
        scope: config.contract,
        table: 'preorders',
        key_type: 'i128',
        index_position: 2,
        limit: 1000
    });

    // console.log(res);

    for (let r = 0; r < res.rows.length; r++){
        const preorder = res.rows[r];
        const actions = [{
            account: config.contract,
            name: 'processpre',
            authorization: [{
                actor: config.contract,
                permission: 'process',
            }],
            data: {
                auction_id: preorder.auction_id,
                auction_period: preorder.auction_period,
                loop_count: 100
            }
        }];

        // console.log(actions);

        try {
            const api_resp = await api.transact({actions}, {
                blocksBehind: 3,
                expireSeconds: 30
            });

            console.log('Preorder success', api_resp.transaction_id);
        }
        catch (e){
            if (e.message.indexOf('started yet') < 0){
                console.log('Preorder check', e.message.replace('assertion failure with message: ', ''));
            }
        }
    }
}

const sleep = (ms) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

const run = async () => {
    auctions = await get_auctions();
    // console.log(auctions);
    let a = 0;
    while (true){
        await check_auctions();
        if (a % 20 === 0){
            await check_preorders();
        }
        await sleep(1000);

        a++;
    }
}

run();
