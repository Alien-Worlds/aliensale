module.exports = {
    private_key: '',
    populate_permission: 'populate',
    payment_permission: 'payment',
    swap_permission: 'swap',
    contract: '',  // account that holds the sale contract
    endpoint: 'https://wax-test.eosdac.io',
    eth: {
        consolidate: '',
        number_validations: 4,
        etherscan_api_key: '',
        etherscan_endpoint: 'https://api-ropsten.etherscan.io/api'
    },
    eos: {
        receive_address: '', // EOS payment address
        wsEndpoint: 'ws://178.63.44.179:8083',  // state history ws
        endpoint: 'https://jungle3.eosdac.io',  // Chain api
        chainId: 'e70aaab8997e1dfce58fbfac80cbbb8fecec7b99cf982a9444273cbc64c41473',
        number_validations: 20,
        default_start_block: 31453905,
        voucher_token_contract: '', // Address that vouchers are printed on
        voucher_burn_address: ''
    }
};
