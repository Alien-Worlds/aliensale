const bip39 = require('bip39');

/*
Generates a mnemonic phrase and seed, this should be output to keys.txt

`node genkey-eth.js > keys.txt`
 */

const mnemonic = bip39.generateMnemonic()

console.log(mnemonic);

const seed = bip39.mnemonicToSeedSync(mnemonic).toString('hex');

console.log(seed);
