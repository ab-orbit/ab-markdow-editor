# Mobile writing and landscape caret

The mobile writing header now shows a compact formatting/info/more capsule. Formatting starts closed; its toggle opens a horizontally scrollable floating strip at the bottom of the available workspace, above the keyboard. The normal full toolbar remains accessible through More. Desktop layout is preserved.

The rich editor observes its pane and visible viewport. Keyboard opening, rotation and formatting-strip changes scroll only the document pane enough to expose the existing caret, preserving the editor selection instead of selecting the beginning/end of the document.

Validation:

- [Chrome](chrome.txt) and [WebKit](webkit.txt): a lower paragraph in a long document remains selected through portrait/landscape and keyboard-sized viewport changes; the caret stays inside the visible editing area and above floating tools; formatting continues at that position.
- Native iPhone simulator: a new note is typed, rotated with the software keyboard open, formatted through the floating toolbar and typed into again. The XCUITest verifies that the appended formatted text is accessible. Differently formatted WKWebView text runs are separate accessibility elements.
- [Portrait](portrait-floating-webkit.png), [landscape with reduced viewport](landscape-keyboard-webkit.png), [actual iOS simulator keyboard](native-iphone-landscape-keyboard.png).

Physical-device confirmation remains the TestFlight tester's next step; the native keyboard test runs on the simulator.
