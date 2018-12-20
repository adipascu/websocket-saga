const path = require('path');
const nodeExternals = require('webpack-node-externals');

module.exports = () => ({
  target: 'electron-renderer',
  externals: [nodeExternals()],
  mode: 'production',
  // mode: 'development',
  // devtool: 'none',
  node: {
    __dirname: false,
    __filename: false,
  },
  entry: './src/main.js',
  output: {
    path: path.join(__dirname, 'lib'),
    libraryTarget: 'commonjs2',
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
});
