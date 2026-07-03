module.exports = {
    apps: [
        {
            name: 'lingocon',
            script: 'node_modules/next/dist/bin/next',
            args: 'start',
            instances: 'max',
            exec_mode: 'cluster',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'lingocon-worker',
            script: 'node_modules/.bin/tsx',
            args: 'scripts/worker.ts',
            instances: 1,
            exec_mode: 'fork',
            env: {
                NODE_ENV: 'production'
            }
        }
    ]
};
