const path = require('path');

module.exports = () => ({
  target: 'electron-renderer',
  // do not bundle redux-saga
  externals: {
    'redux-saga': {
      commonjs2: 'redux-saga',
    },
    'redux-saga/effects': {
      commonjs2: 'redux-saga/effects',
    },
  },
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
