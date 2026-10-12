/** Capture remains disabled until the network isolation gate in tasks 09–12. */
process.stderr.write('Capture disabled: network isolation and request policy are not implemented.\n');
process.exitCode = 1;
