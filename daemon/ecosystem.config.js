module.exports = {
    apps: [
        {
            name: "aliensale-monitor-eos",
            script: "./monitor-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                'CONFIG': 'jungle'
            }
        },
        {
            name: "aliensale-monitor-eth",
            script: "./monitor-eth.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                'CONFIG': 'jungle'
            }
        },
        {
            name: "aliensale-voucherswap-eos",
            script: "./voucherswap-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                'CONFIG': 'jungle'
            }
        },
        {
            name: "eth-redeem",
            script: "./eth-redeem.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                'CONFIG': 'jungle',
                'SERVER_ADDR': '0.0.0.0',
                'SERVER_PORT': 6565
            }
        }
    ]
};
