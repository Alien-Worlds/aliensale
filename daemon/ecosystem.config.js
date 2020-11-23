module.exports = {
    apps: [
        {
            name: "aliensale-monitor-eos-test",
            script: "./monitor-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'test'
            }
        },
        {
            name: "aliensale-monitor-eth-test",
            script: "./monitor-eth.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'test'
            }
        },
        {
            name: "aliensale-voucherswap-eos-test",
            script: "./voucherswap-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'test'
            }
        },
        {
            name: "eth-redeem-test",
            script: "./eth-redeem.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'test'
            }
        },
        {
            name: "sale-log-test",
            script: "./sale-log.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'test'
            }
        },
        {
            name: "aliensale-monitor-eos-prod",
            script: "./monitor-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'prod'
            }
        },
        {
            name: "aliensale-monitor-eth-prod",
            script: "./monitor-eth.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'prod'
            }
        },
        {
            name: "aliensale-voucherswap-eos-prod",
            script: "./voucherswap-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'prod'
            }
        },
        {
            name: "eth-redeem-prod",
            script: "./eth-redeem.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'prod'
            }
        },
        {
            name: "sale-log-prod",
            script: "./sale-log.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG: 'prod'
            }
        }
    ]
};
