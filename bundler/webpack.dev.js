const path = require('path')
const { merge } = require('webpack-merge')
const commonConfiguration = require('./webpack.common.js')
const portFinderSync = require('portfinder-sync')

module.exports = merge(
    commonConfiguration,
    {
        stats: 'errors-warnings',
        mode: 'development',
        devServer: {
            static: {
                directory: path.join(__dirname, '../../dist/client'),
            },
            hot: true,
        },
    }
)
