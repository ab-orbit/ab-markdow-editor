/* Native macOS helper. The result file is passed by the local server, never by a shell. */
function run() {
  ObjC.import('AppKit');
  ObjC.import('Foundation');
  const args = ObjC.deepUnwrap($.NSProcessInfo.processInfo.arguments);
  const resultFile = args[args.length - 1];
  // LaunchServices may reopen the helper without a request. Never write to an arbitrary argv path.
  if (typeof resultFile !== 'string' || !/\/ab-markdown-picker-[^/]+\/result\.json$/.test(resultFile)) return;
  let result;
  try {
    $.NSApplication.sharedApplication.activateIgnoringOtherApps(true);
    const panel = $.NSOpenPanel.openPanel;
    panel.setCanChooseDirectories(true);
    panel.setCanChooseFiles(false);
    panel.setAllowsMultipleSelection(false);
    panel.setCanCreateDirectories(true);
    panel.setTitle('AB Markdown — Selecionar pasta');
    panel.setMessage('Selecione a pasta do repositório ou a pasta onde deseja clonar.');
    panel.setPrompt('Selecionar pasta');
    result = { directory: panel.runModal === $.NSModalResponseOK ? ObjC.unwrap(panel.URL.path) : null };
  } catch (error) { result = { error: String(error) }; }
  const output = $.NSString.alloc.initWithUTF8String(JSON.stringify(result));
  output.writeToFileAtomicallyEncodingError(resultFile, true, $.NSUTF8StringEncoding, null);
}
