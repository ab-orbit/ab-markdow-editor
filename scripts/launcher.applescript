-- Finder sends document-open events to this droplet; paths are shell-quoted individually.
on launchEditor(documentPaths)
    set resourcesPath to (POSIX path of (path to me)) & "Contents/Resources/"
    set commandText to "/usr/bin/nohup " & quoted form of (resourcesPath & "runtime/bin/node") & " " & quoted form of (resourcesPath & "scripts/launch.mjs")
    repeat with documentPath in documentPaths
        set commandText to commandText & " " & quoted form of documentPath
    end repeat
    do shell script commandText & " >/dev/null 2>&1 &"
end launchEditor
on run
    launchEditor({})
end run
on open documentFiles
    set documentPaths to {}
    repeat with documentFile in documentFiles
        set end of documentPaths to POSIX path of documentFile
    end repeat
    launchEditor(documentPaths)
end open
