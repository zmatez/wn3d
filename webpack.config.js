const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const webpack = require("webpack");
const path = require("path");

module.exports = {
    entry: {
        'bundle': path.resolve(__dirname, 'src/setup/start.ts'),
        'worker' : path.resolve(__dirname, 'src/workers/ChunkWorker.ts')
    },
    module: {
        // Use `ts-loader` on any file that ends in '.ts'
        rules: [
            {
                test: /\.ts$/,
                use: [{
                    loader: 'ts-loader',
                    options: {
                        configFile: "tsconfig.webpack.json"
                    }
                }],
                exclude: /node_modules/,
            },
        ],
    },
    // Bundle '.ts' files as well as '.js' files.
    resolve: {
        extensions: ['.ts', '.js'],
        fallback: {
            "buffer": require.resolve("buffer")
        }
    },
    output: {
        filename: '[name].js',
        path: `${process.cwd()}/dist`,
    },
    devtool: 'source-map',
    mode: 'production',
    plugins: [
        new ForkTsCheckerWebpackPlugin(), // run TSC on a separate thread
        new webpack.ProvidePlugin({
            Buffer: ['buffer', 'Buffer'],
        }),
    ]
};