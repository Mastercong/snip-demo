# Snip CLI wrapper — forwards all arguments to cli.js
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
node "$scriptDir\cli.js" @args
