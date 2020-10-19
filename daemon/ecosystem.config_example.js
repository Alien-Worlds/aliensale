const CONFIG = 'jungle'

module.exports = {
    apps: [
        {
            name: "aliensale-monitor-eos",
            script: "./monitor-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        },
        {
            name: "aliensale-monitor-eth",
            script: "./monitor-eth.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        },
        {
            name: "aliensale-voucherswap-eos",
            script: "./voucherswap-eos.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        },
        {
            name: "eth-redeem",
            script: "./eth-redeem.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        },
        {
            name: "sale-log",
            script: "./sale-log.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        },
        {
            name: "process-preorders",
            script: "./process-preorders.js",
            node_args: ["--max-old-space-size=8192"],
            autorestart: true,
            kill_timeout: 3600,
            env: {
                CONFIG
            }
        }
    ]
};
