/**
* Local processes that are ignored globally. Some apps
* like Dropbox keep ports open for syncing, and don't
* really need to show up.
*/
var IGNORED_PROCESSES = [
  'dropbox',
  'livereloa',
  'adobe',
  'agilebits',
  'creative',
  'boom'
];

/**
* Gets a list of running processes on localhost with open ports.
*
*   @return   webProcesses  {array}    array of running processes
*
*   Process item properties:
*   - name: the name of the running process (ruby, node, etc)
*   - pid: the process ID of the running process
*   - port: the port the process is running on
*   - directory: the working directory of the process.
*   - command: additional command paths or arguments given to the process.
*/
function getProcesses() {
  var webProcesses = [];
  var app, pids, pidParts, processInfo, commandInfo, runningDir;

  app = Application.currentApplication();
  app.includeStandardAdditions = true;

  pids = app.doShellScript("lsof -iTCP -sTCP:LISTEN -P -n | awk 'NR>1{print $1, $2, $9}'").split('\r');

  for (var i=0; i<pids.length; i++) {
    pidParts = pids[i].split(' ');
    commandInfo = app.doShellScript("ps aux "+pidParts[1]+" | awk '{if (NR!=1) {print $12}}'");
    runningDir = app.doShellScript("lsof -a -p "+pidParts[1]+" -d cwd -Fn | cut -c2- | grep -v "+pidParts[1]);

    webProcesses.push({
      name: pidParts[0],
      pid: pidParts[1],
      port: pidParts[2].replace('*:', ''),
      command: commandInfo,
      directory: runningDir
    });
  }

  return webProcesses;
}


/**
* Formats process objects into alfred item objects
*
*   @param    process       {object}   the process item to format
*   @return   object        {object}   the formatted alfred item
*/
function processToAlfredItem(process) {
  var running = 'localhost:' + process.port;
  var url = 'http://' + running;

  return {
    title: running + ' ~ ' + process.name,
    subtitle: process.directory + '  ' + process.command,
    arg: url
  };
}


/**
* Formats an array of items into Alfred Results XML.
*
*   @param    items         {array}     alfred item objects to format
*   @return   alfredOutput  {string}    resulting XML string
*
*   Alfred item object properties:
*   - title: the main title text
*   - subtitle: the subtitle text
*   - arg: the argument that the item outputs as {query}
*/
function formatAlfred(items) {
  var alfredOutput;
  items = items || [];


  alfredOutput = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<items>'
  ];

  for (var i=0; i<items.length; i++) {
    alfredOutput = alfredOutput.concat([
      '<item>',
        '<title>',
          items[i].title || '',
        '</title>',
        '<subtitle>',
          items[i].subtitle || '',
        '</subtitle>',
        '<arg>',
          items[i].arg || '',
        '</arg>',
      '</item>'
    ]);
  }

  alfredOutput = alfredOutput.concat([
    '</items>'
  ]);

  return alfredOutput.join('');
}

/**
* Main executuion function.
*
*   @param    query       {string}    the query to filter processes with
*   @return   output      {string}    Aflred ready XML of results
*/
function run() {
  var cliArgs = [].slice.call(arguments[0]);
  var query = cliArgs[0] || '.*';
  var processes = getProcesses();
  var queryExp = new RegExp(query, 'i');
  var alfredItems = [];
  var ignoredExp, processKeys;
  var ignored = false;

  ignoredExp = '(';
  for (var k=0; k<IGNORED_PROCESSES.length; k++) {
    ignoredExp = ignoredExp + (k === 0 ? '' : '|') + IGNORED_PROCESSES[k];
  }
  ignoredExp = ignoredExp + ')';
  ignoredExp = new RegExp(ignoredExp, 'i');

  for (var i=0; i<processes.length; i++) {
    processKeys = Object.keys(processes[i]);
    ignored = false;

    for (var j=0; !ignored && j<processKeys.length; j++) {
      if (ignoredExp.test(processes[i][processKeys[j]])) {
        ignored = true;
      }
    }

    for (var k=0; !ignored && k<processKeys.length; k++) {
      if (queryExp.test(processes[i][processKeys[k]])) {
        alfredItems.push(processToAlfredItem(processes[i]));
        break;
      }
    }
  }

  if (alfredItems.length === 0) {
    alfredItems.push({
      title: 'No running processes found.',
      subtitle: 'Try a different search query, or start a process on localhost.',
      arg: 'http://localhost'
    });
  }

  return formatAlfred(alfredItems);
}
