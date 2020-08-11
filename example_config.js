module.exports = {
    private_key: '', // private key for permissions below
    populate_permission: 'populate',  // permission to populate keys
    payment_permission: 'payment',  // permission to send confirmation of payment
    contract: '', // sale contract on native chain
    endpoint: 'https://wax-test.eosdac.io',  // native endpoint
    eth: {
        consolidate: '',  // consolidate all eth payments to this address with the consolidate script
        project_id: '', // infura project id
        network: 'ropsten',  // eth network
        number_validations: 4,
        default_start_block: 8473465 // start at this block to begin (script will restart from last seen block after starting)
    },
    eos: {
        receive_address: '',  // eos receive address
        wsEndpoint: 'ws://178.63.44.179:8083',  // ship websocket endpoint
        endpoint: 'https://jungle3.eosdac.io',  // eos api node (must have history enabled, block hints are provided)
        chainId: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',  // eos chain id
        number_validations: 20,  // number of blocks to wait before confirming payment
        default_start_block: 29967941
    }
};
