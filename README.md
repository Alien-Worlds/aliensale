# AlienSale

Contracts, UI and monitoring scripts to sell pack tokens (fungible) on the WAX blockchain 
using tokens from other chains.  Currently supports;

- Native WAX sales
- ETH sales
- EOS or EOS Dapp token sales

## Components

### Smart Contracts

The contracts folder contains the contract responsible for the sales.  Firstly, the packs
that will be sold are registered (they must be created and issued manually and then 
transferred to this contract's account).  Once the packs are configured, the user must 
call the `createsale` action to register their intent to purchase some packs if using a 
foreign currency.

#### Native sales

Native sales can be completed within the same transaction, the user must transfer the 
correct payment to the smart contract and within the same transaction execute the `buy`
action.

#### Foreign sales

Non-native currency purchases must first register a sale using the `createsale` action, 
this will create a record of the intent to purchase and convert the native payment amount
to their currency of choice.  The `logsale` action will be called inline which will
allow the user to see the quoted price and the address to send to (in the case of 
Ethereum), or a memo (in the case of EOS payments).

The user will then send the required payment and the off-chain monitoring scripts will 
wait for the required number of confirmations and then notify the contract of the payment.
The pack tokens will then be sent on the native chain.

### Monitoring scripts

Two scripts are provided, one for Ethereum and one for EOS.  These scripts will watch
the chain for payments for registered sales and then configm payment.

### Address generation scripts

The contract stores pre-generated addresses / memos to be used in payments.

#### Ethereum

Ethereum addresses are generated from a seed which can be created using the `genkey-eth.js`
script.  The keys should be output to a keys.txt file so run it like this.

`./genkey-eth.js > keys.txt`

The `genaddress-eth.js` script will then use the seed to generate multiple addresses
and send them to the smart contract.

#### EOS

EOS uses a common address to receive payments but will differentiate using a memo.
The `genaddress-eos.js` script will generate random strings and send them to the chain.


### Configuration

All configuration is stored in the config.js file, copy the `config_example.js` file to
`config.js` and modify to your needs.

### Swap function

The repository also contains a script which can be used to swap airdropped tokens on a foreign 
chain to pack tokens on the native chain.
