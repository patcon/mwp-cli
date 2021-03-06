const chalk = require('chalk');
const Rx = require('rxjs');
const txlib = require('./util');
const pullResourceTrns = require('./util/pullResourceTrns');
const gitHelpers = require('./util/gitHelpers');

const getProjectResourcesList$ =
	txlib.resources$
		// We want to sort the array of resources so that the ALL_TRANSLATIONS_RESOURCE is
		// downloaded first, this will allow other resources to be applied on top of
		// any changes in that resource. Hopefully, this should prevent any changes in
		// feature branches from being overridden by this resource
		.map(resources =>
			resources
				.sort(a => a === txlib.ALL_TRANSLATIONS_RESOURCE ? -1 : 1)
		)
		.flatMap(Rx.Observable.from);

/**
 * Kicks off process to downloaded an individual resources trns
 * @param  {String} resource resource slug to be used when we downloaded translations
 * @return {Observable} Observable of tx process
 */
const pullResource$ = (resource) => {
	console.log(chalk.cyan(`Starting tx:pull for '${resource}'`));
	return pullResourceTrns.pullResourceContent$(resource)
		.toArray() // wait until all content has been downloaded before moving on to next tasks
		.do(() => console.log(chalk.green(`\nCompleted tx:pull for '${resource}'`)))
		.map(() => resource);
};

module.exports = {
	command: 'pullAll',
	description: 'Downloads all translations for resources from Transifex, ordered by most recently updated',
	builder: yarg =>
		yarg.option({
			commit: {
				alias: 'c',
				default: false
			},
		}),
	handler: argv => {
		txlib.checkEnvVars();
		console.log(chalk.magenta('Start downloading all resources process...'));

		getProjectResourcesList$
			.flatMap(pullResource$, 1)
			.flatMap(resource => {
				if (!argv.commit) {
					return Rx.Observable.empty();
				}
				const commitMessage = `tx:pull for ${resource.replace(/-/g, '_')}`;
				return gitHelpers.commit$(commitMessage, `--no-verify`);
			})
			.subscribe(null, error => { throw error; }, () => console.log(chalk.green('All resources pulled.')));
	},
};
