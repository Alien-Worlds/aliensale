
const { Serialize } = require('eosjs');
const fs = require('fs');
const { exec } = require('child_process');

async function transactCleos(trx, options, auth, cleos, api){
    // const logger = require('./logger')('functions:transactCleos');

    return new Promise(async (resolve, reject) => {
        options.broadcast = false;
        options.sign = false;

        const rnd = Math.random();

        const tmp_file = `.transactcleos.${rnd}.trx`;
        // const debug_file = `.transactcleos.debug.${rnd}.trx`;

        const res = await api.transact(trx, options);

        const buffer = new Serialize.SerialBuffer({
            textDecoder: new TextDecoder(),
            textEncoder: new TextEncoder(),
            array: res.serializedTransaction,
        });

        buffer.restartRead();
        const trx_json = await api.deserialize(buffer, 'transaction');

        fs.writeFileSync(tmp_file, JSON.stringify(trx_json));


        let cmd = `${cleos} push transaction ./${tmp_file} -p `;
        if (typeof auth === 'string'){
            cmd += auth;
        }
        else if (typeof auth.join === 'function') {
            cmd += auth.join(' -p ');
        }
        else {
            console.error(`Invalid value supplied for auth`);
            return;
        }
        // const cmd = `echo 'not sending'`;

        try {
            exec(cmd, (err, stdout, stderr) => {
                if (err) {
                    // node couldn't execute the command
                    // logger.error(err);
                    reject(err);
                    // if (fs.existsSync(tmp_file)){
                    //     fs.unlinkSync(tmp_file);
                    // }
                    return;
                }

                // console.log(stdout);

                if (fs.existsSync(tmp_file)){
                    fs.unlinkSync(tmp_file);
                }

                let out;
                try {
                    const json = JSON.parse(stdout);

                    out = json;
                }
                catch (e){
                    out = stdout;
                }

                resolve(out);

            });
        }
        catch (e){
            console.error(`Caught error!!`);
            reject(e);

            if (fs.existsSync(tmp_file)){
                fs.unlinkSync(tmp_file);
            }
        }

    });


};

module.exports = {transactCleos}
