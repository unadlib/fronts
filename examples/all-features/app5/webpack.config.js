const path = require("path");
const { VueLoaderPlugin } = require("vue-loader");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const { createWebpackConfig, insertStyle } = require('fronts-bundler');

module.exports = (env = {}) => createWebpackConfig({
  mode: "development",
  cache: false,
  devtool: "source-map",
  optimization: {
    minimize: false,
  },
  target: "web",
  entry: path.resolve(__dirname, "./src/bootstrap.js"),
  output: {
    publicPath: "auto",
  },
  resolve: {
    extensions: [".vue", ".jsx", ".js", ".json"],
    alias: {
      vue: "vue/dist/vue.esm-bundler.js",
    },
  },
  module: {
    rules: [
      {
        test: /\.vue$/,
        use: "vue-loader",
      },
      {
        test: /\.png$/,
        use: {
          loader: "url-loader",
          options: { limit: 8192 },
        },
      },
      {
        test: /\.css$/,
        use: [
          {
            loader: MiniCssExtractPlugin.loader,
            options: { hmr: !env.prod },
          },
          "css-loader",
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].css",
      insert: insertStyle
    }),
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, "./index.html"),
      chunks: ["main"],
    }),
    new VueLoaderPlugin(),
  ],
  devServer: {
    contentBase: path.join(__dirname),
    compress: true,
    port: 3005,
    hot: true,
  },
});
