const webpack = require('webpack');
const path = require('path');

module.exports = () => {
  return {
    target: 'electron-renderer',
    mode: 'production',
    // mode: 'development',
    // devtool: 'none',
    node: {
      __dirname: false,
      __filename: false,
    },
    entry: './src/main.js',
    // entry: './src/second.js',
    output: {
      path: path.join(__dirname, 'lib'),
      libraryTarget: "commonjs2",
    },
    module: {
      rules: [
        {
          test: /\.jsx?$/,
          include: path.resolve(__dirname, 'src'),
          use: [
            {
              loader: 'babel-loader',
            },
          ],
        },
      ],
    },
    resolve: {
      extensions: ['.js'],
    },
  };
};
