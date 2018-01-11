const chalk = require('chalk');
const child_process = require('child_process');
const Rx = require('rxjs');
const txlib = require('./index');

const child_process$ = Rx.Observable.bindNodeCallback(child_process.exec);

/**
 * Creates git commit of what has been staged
 * @param  {String} commitMessage what commit message to commit
 * @param  {String} args additional args to include with commit
 * @return {Observable} Observable of tx process
 */
const commit$ = (commitMessage, args) => {
	return child_process$('git status')
		.flatMap(([stdout, stderr]) => {
			if (!stdout.includes('modified:')) {
				console.log(chalk.grey('no changes to commit'));
				return Rx.Observable.empty();
			}

			child_process.execSync('git add .');
			const command = `git commit -m ${JSON.stringify(commitMessage)} ${args}`;
			return child_process$(command)
				.do(() => {
					console.log(chalk.green(command));
				});
		});
};

const devGitBranch$ = Rx.Observable.bindNodeCallback(child_process.exec)(
	'git rev-parse --abbrev-ref HEAD'
)
	.pluck(0)
	.map(str => str.slice(0, -1));

// Branch whether in dev or CI. Replaces forward slashes because
// branch names are used as transifex resource names and resource
// names need to work as valid url paths
const gitBranch$ = Rx.Observable
	.if(
	() => process.env.TRAVIS_PULL_REQUEST_BRANCH,
	Rx.Observable.of(process.env.TRAVIS_PULL_REQUEST_BRANCH),
	devGitBranch$
	)
	.map(branchname => branchname.replace(/\//g, '_'));

const branchResourceExists$ = Rx.Observable
	.zip(txlib.resources$, gitBranch$)
	.map(([resources, branch]) => resources.indexOf(branch) > -1);

// don't run against master! will delete trn content on transifex
const branchCheck$ = gitBranch$.do(branchName => {
	if (branchName === 'master') {
		console.log(
			'do not run this script on master. it will kill the master resource on Transifex.'
		);
		process.exit(0);
	}
});



module.exports = {
	commit$,
	devGitBranch$,
	gitBranch$,
	branchResourceExists$,
	branchCheck$,
};
