ObjC.import('AppKit');
ObjC.import('Foundation');
/** Create a Finder bookmark alias; POSIX symlinks may display as folders in list views. */
function run(args) {
  if (args.length < 2 || args.length > 3) throw new Error('Expected application and desktop alias paths.');
  const source = $.NSURL.fileURLWithPath(args[0]);
  const destination = $.NSURL.fileURLWithPath(args[1]);
  const error = Ref();
  if (args[2] === '--check') {
    const resolved = $.NSURL.URLByResolvingAliasFileAtURLOptionsError(destination, 0, error);
    if (!resolved || ObjC.unwrap(resolved.path) !== args[0]) throw new Error('The existing item is not our application alias.');
    return;
  }
  const data = source.bookmarkDataWithOptionsIncludingResourceValuesForKeysRelativeToURLError(1024, $(), $(), error);
  if (!data || !$.NSURL.writeBookmarkDataToURLOptionsError(data, destination, 0, error)) {
    throw new Error('Could not create the Finder alias.');
  }
  const icon = $.NSImage.alloc.initWithContentsOfFile(args[0] + '/Contents/Resources/AppIcon.icns');
  if (!$.NSWorkspace.sharedWorkspace.setIconForFileOptions(icon, args[1], 0)) {
    throw new Error('Could not set the desktop alias artwork.');
  }
  $.NSWorkspace.sharedWorkspace.noteFileSystemChanged(args[1]);
}
