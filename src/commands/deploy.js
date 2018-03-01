module.exports = {
	command: 'deploy',
	describe: 'deploy the current application to production',
	builder: yargs =>
		yargs
			.options({
				servicesId: {
					default: 'default',
					describe: 'The GAE service name',
				},
				pollWait: {
					default: 10000, // 10 seconds
					describe: 'The time to wait between progress checks',
				},
			})
			.commandDir('deployCommands')
			.demandCommand(),
};
