ObjC.import('AppKit');
ObjC.import('Foundation');
/** Apply Finder's custom icon metadata so existing aliases refresh after an update. */
function run(args) {
  if (args.length !== 2) throw new Error('Expected icon file and application bundle.');
  const image = $.NSImage.alloc.initWithContentsOfFile(args[0]);
  if (!image || !$.NSWorkspace.sharedWorkspace.setIconForFileOptions(image, args[1], 0)) {
    throw new Error('Could not apply the application icon in Finder.');
  }
  $.NSWorkspace.sharedWorkspace.noteFileSystemChanged(args[1]);
}
