import {
  getWebpackAotConfigPartial,
  getWebpackNonAotConfigPartial
} from './webpack-build-typescript';
import * as webpack from 'webpack';
const webpackMerge = require('webpack-merge');
import { CliConfig } from './config';
import {
  getWebpackCommonConfig,
  getWebpackDevConfigPartial,
  getWebpackProdConfigPartial,
  getWebpackMobileConfigPartial,
  getWebpackMobileProdConfigPartial
} from './';

export class NgCliWebpackConfig {
  // TODO: When webpack2 types are finished lets replace all these any types
  // so this is more maintainable in the future for devs
  public config: any;

  constructor(
    public ngCliProject: any,
    public target: string,
    public environment: string,
    outputDir?: string,
    baseHref?: string,
    isAoT = false
  ) {
    const config: CliConfig = CliConfig.fromProject();
    const appConfig = config.config.apps[0];

    appConfig.outDir = outputDir || appConfig.outDir;

    let baseConfig = getWebpackCommonConfig(
      this.ngCliProject.root,
      environment,
      appConfig,
      baseHref
    );
    let targetConfigPartial = this.getTargetConfig(this.ngCliProject.root, appConfig);
    const typescriptConfigPartial = isAoT
      ? getWebpackAotConfigPartial(this.ngCliProject.root, appConfig)
      : getWebpackNonAotConfigPartial(this.ngCliProject.root, appConfig);

    if (appConfig.mobile) {
      let mobileConfigPartial = getWebpackMobileConfigPartial(this.ngCliProject.root, appConfig);
      let mobileProdConfigPartial = getWebpackMobileProdConfigPartial(this.ngCliProject.root,
        appConfig);
      baseConfig = this.betterWebpackMerge(baseConfig, mobileConfigPartial);
      if (this.target == 'production') {
        targetConfigPartial = this.betterWebpackMerge(targetConfigPartial, mobileProdConfigPartial);
      }
    }

    this.config = this.betterWebpackMerge(
      baseConfig,
      targetConfigPartial,
      typescriptConfigPartial
    );
  }

  getTargetConfig(projectRoot: string, appConfig: any): any {
    switch (this.target) {
      case 'development':
        return getWebpackDevConfigPartial(projectRoot, appConfig);
      case 'production':
        return getWebpackProdConfigPartial(projectRoot, appConfig);
      default:
        throw new Error("Invalid build target. Only 'development' and 'production' are available.");
    }
  }

  betterWebpackMerge(baseConfig: any, targetConfig: any, targetTypeScriptConfig?: any) {
    let basePlugins = (baseConfig && baseConfig.plugins) || [];
    let targetPlugins = (targetConfig && targetConfig.plugins) || [];
    let targetTypeScriptPlugins = (targetTypeScriptConfig && targetTypeScriptConfig.plugins) || [];
    let baseOptionsPlugins = basePlugins
      .filter((plugin: any) => plugin instanceof webpack.LoaderOptionsPlugin)
      .map((plugin: any) => plugin.options.options);
    let targetOptionsPlugins = targetPlugins
      .filter((plugin: any) => plugin instanceof webpack.LoaderOptionsPlugin)
      .map((plugin: any) => plugin.options.options);
    let targetTypeScriptOptionsPlugins = targetTypeScriptPlugins
      .filter((plugin: any) => plugin instanceof webpack.LoaderOptionsPlugin)
      .map((plugin: any) => plugin.options.options);
    let mergedConfig = webpackMerge(
      baseConfig,
      targetConfig,
      targetTypeScriptConfig
    );
    if (
      baseOptionsPlugins.length > 0 ||
      targetOptionsPlugins.length > 0 ||
      targetTypeScriptOptionsPlugins.length > 0
    ) {
      let mergedBase = baseOptionsPlugins.reduce((base: any, next: any) => {
        Object.assign(base, next);
        return base;
      }, {});
      let mergedTarget = targetOptionsPlugins.reduce((base: any, next: any) => {
        Object.assign(base, next);
        return base;
      }, {});
      let mergedTargetTypeScript = targetTypeScriptOptionsPlugins.reduce((base: any, next: any) => {
        Object.assign(base, next);
        return base;
      }, {});
      if (mergedConfig.plugins) {
        mergedConfig.plugins = mergedConfig.plugins.filter((plugin: any) => {
          return !(plugin instanceof webpack.LoaderOptionsPlugin);
        });
        mergedConfig.plugins.push(new webpack.LoaderOptionsPlugin({
          options: Object.assign(mergedBase, mergedTarget, mergedTargetTypeScript)
        }));
      }
    }
    return mergedConfig;
  }
}
