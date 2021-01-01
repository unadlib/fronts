/* eslint-disable @typescript-eslint/no-var-requires */
import path from 'path';

export const getPlugins = () => {
  const webpack = require('webpack');
  const siteConfig = require(path.resolve(process.cwd(), 'site.json'));
  return [
    new webpack.DefinePlugin({
      'process.env.APP_NAME': JSON.stringify(`${siteConfig.name}/bootstrap`),
    }),
    new webpack.container.ModuleFederationPlugin(siteConfig),
  ];
};
