const path = require('path');
const webpack = require('webpack');
const ManifestPlugin = require('webpack-manifest-plugin');
const StatsPlugin = require('webpack-stats-plugin').StatsWriterPlugin;
const SWPrecacheWebpackPlugin = require('sw-precache-webpack-plugin');

const paths = require('../paths');
const env = require('../env');
const prodPlugins = require('./prodPlugins');
const rules = require('./rules');

/**
 * When in dev, we need to manually inject some configuration to enable HMR
 *
 * @param {Object} config webpack config object
 * @returns {Object} HMR-ified config
 */
function injectHotReloadConfig(config) {
	config.entry.app.unshift(
		'react-hot-loader/patch', // logic for hot-reloading react components
		`webpack-dev-server/client?http://${env.properties.asset_server.host}:${env
			.properties.asset_server.port}/`, // connect to HMR websocket
		'webpack/hot/dev-server' // run the dev server
	);

	// plugins
	config.plugins.push(new webpack.HotModuleReplacementPlugin()); // enable module.hot
	config.plugins.push(new webpack.NamedModulesPlugin()); // show HMR module filenames
	config.module.rules.unshift(rules.js.hot);

	return config;
}

/*
 * Webpack config object determined by passed-in localeCode. The language is
 * used to resolve the translated message module paths in applications that
 * support translations (currently not supported by starter kit), but also
 * to determine the output path
 */
function getConfig(localeCode) {
	const config = {
		entry: {
			app: [paths.src.browser.entry],
		},

		output: {
			path: path.resolve(paths.output.browser, localeCode),
			filename: env.properties.isDev
				? '[name].js' // in dev, keep the filename consistent to make reloading easier
				: '[name].[chunkhash].js', // in prod, add hash to enable long-term caching
			hashDigestLength: 8,
			publicPath: `/static/${localeCode}/`,
		},

		devtool: 'cheap-module-source-map', // similar speed to 'eval', but with proper source maps

		module: { rules: [rules.css, rules.js.browser] },

		resolveLoader: {
			alias: {
				'require-loader': path.resolve(__dirname, 'require-loader.js'),
			},
		},

		resolve: {
			alias: {
				src: paths.src.browser.app,
				trns: path.resolve(paths.src.trns, 'modules', localeCode),
			},
			// module name extensions that Webpack will try if no extension provided
			extensions: ['.js', '.jsx', '.json'],
		},
		plugins: [
			new webpack.EnvironmentPlugin({
				NODE_ENV: 'development', // required for prod build of React (specify default)
			}),
			new webpack.DllReferencePlugin({
				context: '.',
				manifest: require(path.resolve(
					paths.output.vendor,
					'react-dll-manifest.json'
				)),
			}),
			new webpack.DllReferencePlugin({
				context: '.',
				manifest: require(path.resolve(
					paths.output.vendor,
					'vendor-dll-manifest.json'
				)),
			}),
			new ManifestPlugin({ writeToFileEmit: true }), // emit manifest from dev-server build
			new StatsPlugin({ fields: null }), // null means 'all fields in stats file'
		],
	};

	if (env.properties.isDev && !env.properties.disable_hmr) {
		injectHotReloadConfig(config);
	}
	if (env.properties.isProd) {
		config.plugins = config.plugins.concat(
			prodPlugins,
			new SWPrecacheWebpackPlugin({
				cacheId: 'mwp',
				dontCacheBustUrlsMatching: /\.\w{8}\./, // no need for cache-busting querystring on hashed filenames
				filename: `asset-service-worker.js`,
				minify: true,
				staticFileGlobsIgnorePatterns: [
					// don't cache these files
					/\.map$/, // source-maps
					/.json$/, // manifest files
				],
			})
		);
	}
	return config;
}

// export the config-building function _only_ - this cannot be run by the CLI
module.exports = getConfig;