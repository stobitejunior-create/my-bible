// My Bible — a native macOS shell around dist/bible.html.
// The page is served from inside the app bundle through the private "bible://" scheme (no server, no localhost),
// so localStorage and IndexedDB (highlights, notes, imported Bibles) persist per app.
// Build with mac/build.sh.

import Cocoa
import WebKit

let SCHEME = "bible"
let START = URL(string: "\(SCHEME)://app/bible.html")!

/// Serves files from Contents/Resources/web for bible://app/<path>.
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        var path = url.path
        if path.isEmpty || path == "/" { path = "/bible.html" }
        // the book Library (see Library.swift); slow work (iCloud downloads, conversions) runs off the main thread
        if path.hasPrefix("/lib/") {
            let parts = path.dropFirst(5).split(separator: "/").map(String.init)
            let fail = { task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist)) }
            if parts.first == "index.json" || parts.first == "index-fresh.json" {
                let fresh = parts.first == "index-fresh.json"
                BookLibrary.shared.work.async { let d = fresh ? BookLibrary.shared.indexJSON() : BookLibrary.shared.quickIndexJSON(); DispatchQueue.main.async { self.respond(task, url, d, "application/json") } }
                return
            }
            guard parts.count == 2 else { return fail() }
            if parts[0] == "file" {
                BookLibrary.shared.work.async {
                    let r = BookLibrary.shared.file(parts[1])
                    DispatchQueue.main.async { if let (d, k) = r { self.respond(task, url, d, k == "pdf" ? "application/pdf" : "application/epub+zip") } else { fail() } }
                }
                return
            }
            if parts[0] == "cover" {
                BookLibrary.shared.work.async { BookLibrary.shared.cover(parts[1]) { d in DispatchQueue.main.async { if let d { self.respond(task, url, d, "image/jpeg") } else { fail() } } } }
                return
            }
            return fail()
        }
        // Dag Heward-Mills books from Ben's EPUB folder (see Epub.swift)
        if path == "/epub-index.json" { return respond(task, url, EpubLibrary.shared.indexJSON(), "application/json") }
        if path.hasPrefix("/epub/") {
            let rest = path.dropFirst(6).split(separator: "/", maxSplits: 1).map(String.init)
            if rest.count == 2, let d = EpubLibrary.shared.file(rest[0], rest[1]) {
                let ext = (rest[1] as NSString).pathExtension.lowercased()
                let types = ["xhtml": "application/xhtml+xml; charset=utf-8", "html": "text/html; charset=utf-8", "htm": "text/html; charset=utf-8", "css": "text/css",
                             "jpg": "image/jpeg", "jpeg": "image/jpeg", "png": "image/png", "gif": "image/gif", "svg": "image/svg+xml", "xml": "application/xml",
                             "ncx": "application/xml", "ttf": "font/ttf", "otf": "font/otf", "woff": "font/woff", "woff2": "font/woff2"]
                return respond(task, url, d, types[ext] ?? "application/octet-stream")
            }
            return task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
        }
        let base = Bundle.main.resourceURL!.appendingPathComponent("web")
        let file = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(base.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }
        let type = ["html": "text/html; charset=utf-8", "js": "text/javascript", "mjs": "text/javascript", "css": "text/css", "png": "image/png"][file.pathExtension] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": type, "Content-Length": String(data.count)])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
    }
    func respond(_ task: WKURLSchemeTask, _ url: URL, _ data: Data, _ type: String) {
        let r = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: ["Content-Type": type, "Content-Length": String(data.count), "Cache-Control": "no-store"])!
        task.didReceive(r); task.didReceive(data); task.didFinish()
    }
    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}
}

final class AppDelegate: NSObject, NSApplicationDelegate, WKUIDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    var window: NSWindow!
    var web: WKWebView!
    var titleObserver: NSKeyValueObservation?
    let selfTest = ProcessInfo.processInfo.environment["MYBIBLE_SELFTEST"] != nil

    func applicationDidFinishLaunching(_ note: Notification) {
        let config = WKWebViewConfiguration()
        config.setURLSchemeHandler(BundleSchemeHandler(), forURLScheme: SCHEME)
        config.websiteDataStore = .default()
        config.preferences.isElementFullscreenEnabled = true   // verse shuffle full screen
        config.userContentController.add(self, name: "native")
        // Let the page know it is running in the Mac app, and give it every installed font family for Settings → Font.
        let families = NSFontManager.shared.availableFontFamilies.filter { !$0.hasPrefix(".") }.sorted()
        let fontsJSON = String(data: try! JSONSerialization.data(withJSONObject: families), encoding: .utf8)!
        config.userContentController.addUserScript(WKUserScript(
            source: "document.documentElement.classList.add('macapp'); window.MAC_APP=true; window.MAC_FONTS=\(fontsJSON);",
            injectionTime: .atDocumentStart, forMainFrameOnly: true))

        web = WKWebView(frame: .zero, configuration: config)
        web.uiDelegate = self
        web.navigationDelegate = self
        web.allowsMagnification = true
        web.setValue(false, forKey: "drawsBackground")   // no white flash in dark mode

        window = NSWindow(contentRect: NSRect(x: 0, y: 0, width: 1180, height: 820),
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.minSize = NSSize(width: 380, height: 480)
        window.title = "My Bible"
        window.contentView = web
        window.setFrameAutosaveName("MyBibleMain")
        if !window.setFrameUsingName("MyBibleMain") { window.center() }
        window.makeKeyAndOrderFront(nil)
        titleObserver = web.observe(\.title) { [weak self] w, _ in
            if let t = w.title, !t.isEmpty { self?.window.title = t }
        }
        buildMenu()
        EpubLibrary.shared.rebuild { [weak self] in self?.js("window.epubReload&&epubReload()") }
        web.load(URLRequest(url: START))
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ app: NSApplication) -> Bool { true }

    // MARK: menus
    func buildMenu() {
        let main = NSMenu()
        func item(_ title: String, _ action: Selector?, _ key: String = "", _ mods: NSEvent.ModifierFlags = [.command]) -> NSMenuItem {
            let i = NSMenuItem(title: title, action: action, keyEquivalent: key)
            i.keyEquivalentModifierMask = mods
            return i
        }
        let app = NSMenu()
        app.addItem(item("About My Bible", #selector(showAbout)))
        app.addItem(.separator())
        app.addItem(item("Hide My Bible", #selector(NSApplication.hide(_:)), "h"))
        app.addItem(item("Hide Others", #selector(NSApplication.hideOtherApplications(_:)), "h", [.command, .option]))
        app.addItem(.separator())
        app.addItem(item("Quit My Bible", #selector(NSApplication.terminate(_:)), "q"))
        let file = NSMenu(title: "File")
        file.addItem(item("Import a Bible (XML or JSON)…", #selector(importBible), "o"))
        file.addItem(item("Choose Dag Heward-Mills Book Folder…", #selector(chooseBooks)))
        file.addItem(item("Choose Library Folder…", #selector(chooseLibrary)))
        file.addItem(.separator())
        file.addItem(item("Close Window", #selector(NSWindow.performClose(_:)), "w"))
        let edit = NSMenu(title: "Edit")
        edit.addItem(item("Undo", Selector(("undo:")), "z"))
        edit.addItem(item("Redo", Selector(("redo:")), "z", [.command, .shift]))
        edit.addItem(.separator())
        edit.addItem(item("Cut", #selector(NSText.cut(_:)), "x"))
        edit.addItem(item("Copy", #selector(NSText.copy(_:)), "c"))
        edit.addItem(item("Paste", #selector(NSText.paste(_:)), "v"))
        edit.addItem(item("Select All", #selector(NSText.selectAll(_:)), "a"))
        edit.addItem(.separator())
        edit.addItem(item("Search…", #selector(search), "f"))
        let go = NSMenu(title: "Go")
        go.addItem(item("Go to Book and Chapter…", #selector(goTo), "k"))
        go.addItem(item("Previous Chapter", #selector(prevChapter), "["))
        go.addItem(item("Next Chapter", #selector(nextChapter), "]"))
        go.addItem(.separator())
        go.addItem(item("Random Reading", #selector(randomReading), "r"))
        go.addItem(item("Reading Plan…", #selector(readingPlan), "p", [.command, .shift]))
        go.addItem(item("Verse Shuffle", #selector(verseShuffle), "v", [.command, .shift]))
        go.addItem(item("Highlights and Notes", #selector(highlights), "b", [.command, .shift]))
        go.addItem(item("Bookmarks and History", #selector(bookmarks), "y"))
        go.addItem(.separator())
        go.addItem(item("Library", #selector(library), "l", [.command, .shift]))
        let view = NSMenu(title: "View")
        view.addItem(item("Actual Size", #selector(zoomReset), "0"))
        view.addItem(item("Zoom In", #selector(zoomIn), "="))
        view.addItem(item("Zoom Out", #selector(zoomOut), "-"))
        view.addItem(.separator())
        view.addItem(item("Settings…", #selector(settings), ","))
        view.addItem(.separator())
        view.addItem(item("Enter Full Screen", #selector(NSWindow.toggleFullScreen(_:)), "f", [.command, .control]))
        let win = NSMenu(title: "Window")
        win.addItem(item("Minimize", #selector(NSWindow.performMiniaturize(_:)), "m"))
        win.addItem(item("Zoom", #selector(NSWindow.performZoom(_:))))
        for (title, sub) in [("My Bible", app), ("File", file), ("Edit", edit), ("Go", go), ("View", view), ("Window", win)] {
            let top = NSMenuItem(title: title, action: nil, keyEquivalent: "")
            top.submenu = sub
            main.addItem(top)
        }
        NSApp.mainMenu = main
        NSApp.windowsMenu = win
    }

    func js(_ code: String) { web.evaluateJavaScript(code, completionHandler: nil) }
    @objc func goTo() { js("openNav(true)") }
    @objc func search() { js("openNav(true)") }
    @objc func prevChapter() { js("document.getElementById('prev').click()") }
    @objc func nextChapter() { js("document.getElementById('next').click()") }
    @objc func randomReading() { js("document.getElementById('rand').click()") }
    @objc func readingPlan() { js("openPlan()") }
    @objc func verseShuffle() { js("shufOpen()") }
    @objc func highlights() { js("closeSheets(); showMarks('all')") }
    @objc func bookmarks() { js("closeSheets(); showBookmarks()") }
    @objc func library() { js("closeSheets(); libOpen()") }
    /// The folder of books the Library shows (default: iCloud Drive › Authors).
    @objc func chooseLibrary() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
        panel.message = "Choose the folder that holds your books (EPUB, PDF, MOBI)"
        panel.directoryURL = BookLibrary.shared.folder
        panel.beginSheetModal(for: window) { [weak self] r in
            guard r == .OK, let url = panel.url else { return }
            BookLibrary.shared.setFolder(url); self?.js("libReload&&libReload(true)")
        }
    }
    /// The folder of EPUBs the Dag Heward-Mills picker reads chapters from.
    @objc func chooseBooks() {
        let panel = NSOpenPanel()
        panel.canChooseDirectories = true; panel.canChooseFiles = false; panel.allowsMultipleSelection = false
        panel.message = "Choose the folder that holds your Dag Heward-Mills EPUB books"
        if let f = EpubLibrary.shared.folder { panel.directoryURL = f }
        panel.beginSheetModal(for: window) { [weak self] r in
            guard r == .OK, let url = panel.url else { return }
            EpubLibrary.shared.setFolder(url) { self?.js("window.epubReload&&epubReload(); toast('Found ' + \(EpubLibrary.shared.books.count) + ' books')") }
        }
    }
    @objc func settings() { js("document.getElementById('gear').click()") }
    @objc func showAbout() { js("closeSheets(); document.getElementById('modal').classList.add('open')") }
    @objc func zoomIn() { web.pageZoom = min(web.pageZoom + 0.1, 2.5) }
    @objc func zoomOut() { web.pageZoom = max(web.pageZoom - 0.1, 0.6) }
    @objc func zoomReset() { web.pageZoom = 1 }

    /// File → Import: read the XML natively and hand the text to the page's importer.
    @objc func importBible() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.xml, .json, .data]
        panel.allowsMultipleSelection = false
        panel.message = "Choose a Bible in Zefania, OSIS, USFX, Beblia or OpenSong XML format"
        panel.beginSheetModal(for: window) { [weak self] r in
            guard r == .OK, let url = panel.url, let self else { return }
            guard let data = try? Data(contentsOf: url) else { return self.alert("Couldn’t read that file.") }
            let text = String(data: data, encoding: .utf8) ?? String(decoding: data, as: UTF8.self)
            self.web.callAsyncJavaScript("return importXMLText(t, n)", arguments: ["t": text, "n": url.lastPathComponent],
                                        in: nil, in: .page) { result in
                if case .failure(let e) = result { self.alert(e.localizedDescription) }
            }
        }
    }

    func alert(_ text: String) {
        let a = NSAlert()
        a.messageText = text
        a.beginSheetModal(for: window)
    }

    // MARK: WKUIDelegate — file inputs, alerts, confirms, new windows
    func webView(_ webView: WKWebView, runOpenPanelWith parameters: WKOpenPanelParameters,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping ([URL]?) -> Void) {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = parameters.allowsMultipleSelection
        panel.beginSheetModal(for: window) { r in completionHandler(r == .OK ? panel.urls : nil) }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let a = NSAlert(); a.messageText = message
        a.beginSheetModal(for: window) { _ in completionHandler() }
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String,
                 initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let a = NSAlert(); a.messageText = message
        a.addButton(withTitle: "OK"); a.addButton(withTitle: "Cancel")
        a.beginSheetModal(for: window) { r in completionHandler(r == .alertFirstButtonReturn) }
    }
    /// target="_blank" links (e.g. NKJV on Blue Letter Bible) open in the default browser.
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url { NSWorkspace.shared.open(url) }
        return nil
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = action.request.url, url.scheme != SCHEME, url.scheme != "about", url.scheme != "blob", url.scheme != "data" {
            NSWorkspace.shared.open(url)
            return decisionHandler(.cancel)
        }
        decisionHandler(.allow)
    }

    // MARK: self-test (MYBIBLE_SELFTEST=1): checks storage survives a reload, then quits
    var testStage = 0
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        // MYBIBLE_EVAL="js" runs that JavaScript 3 s after loading (for screenshots of a particular screen).
        if let code = ProcessInfo.processInfo.environment["MYBIBLE_EVAL"] {
            DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [self] in web.callAsyncJavaScript(code, arguments: [:], in: nil, in: .page) { _ in } }
        }
        guard selfTest else { return }
        DispatchQueue.main.asyncAfter(deadline: .now() + 3) { [self] in
            if testStage == 0 {
                testStage = 1
                web.callAsyncJavaScript("""
                    localStorage.setItem('selftest','ok');
                    await idb('meta','put',{id:'x_selftest',name:'Self test',abbr:'ST'});
                    return document.title + ' | loaded:' + !document.getElementById('loading');
                    """, arguments: [:], in: nil, in: .page) { r in
                    print("SELFTEST first load:", r)
                    self.web.reload()
                }
            } else {
                web.callAsyncJavaScript("""
                    const m = await idb('meta','get','x_selftest'); await idb('meta','del','x_selftest');
                    const ls = localStorage.getItem('selftest'); localStorage.removeItem('selftest');
                    let idx = null; for (let i = 0; i < 90; i++) { idx = await (await fetch('epub-index.json')).json(); if (!idx.building) break; await new Promise(r => setTimeout(r, 1000)); }
                    const bk = (idx.books || []).find(b => /Loyalty and Disloyalty/i.test(b.title)) || (idx.books || [])[0];
                    let ch = 'none'; if (bk && bk.toc.length) { const r = await fetch('epub/' + bk.id + '/' + bk.toc[Math.min(3, bk.toc.length - 1)][1].split('#')[0]); ch = r.status + ' ' + (await r.text()).length + ' bytes'; }
                    const ep = 'epubs=' + (idx.books || []).length + ' sample=' + (bk ? bk.title + ' toc=' + bk.toc.length : '-') + ' chapter fetch=' + ch;
                    await epubIndex(true);
                    const tt = MAKARIOS.map(m => m[0]), hit = tt.filter(t => epFor(t)), miss = tt.filter(t => !epFor(t));
                    const off = hit.filter(t => { const n = MAKARIOS.find(m => m[0] === t)[1]; return n && epFor(t).ch.length !== n; });
                    const ex = hit.slice(0, 3).map(t => t + ' ch1=' + (epFor(t).ch[0] || ['-'])[0]).join(' ; ');
                    const dhm = 'matched=' + hit.length + '/' + tt.length + ' countsDiffer=' + off.length + ' [' + off.slice(0, 6).map(t => t + ':' + MAKARIOS.find(m => m[0] === t)[1] + '≠' + epFor(t).ch.length).join(', ') + '] unmatched=[' + miss.slice(0, 8).join(', ') + '] e.g. ' + ex;
                    return ep + ' | ' + dhm + ' | after reload: localStorage=' + ls + ' indexedDB=' + (m ? m.name : 'missing') + ' | ' + document.title + ' | versions=' + Object.keys(VN).length + ' | fonts=' + (window.MAC_FONTS||[]).length + ' e.g. ' + (window.MAC_FONTS||[]).slice(0,4).join(', ');
                    """, arguments: [:], in: nil, in: .page) { r in
                    print("SELFTEST", r)
                    NSApp.terminate(nil)
                }
            }
        }
    }
    /// Messages from the page: {type:'file', name, text} saves a file (a .ics opens in Calendar to add the reminder).
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let m = message.body as? [String: Any], (m["type"] as? String) == "file",
              let name = m["name"] as? String, let text = m["text"] as? String else { print("page:", message.body); return }
        let safe = name.replacingOccurrences(of: "/", with: "-")
        if safe.lowercased().hasSuffix(".ics") {
            let dir = FileManager.default.temporaryDirectory.appendingPathComponent("My Bible", isDirectory: true)
            try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
            let f = dir.appendingPathComponent(safe)
            do { try text.write(to: f, atomically: true, encoding: .utf8); NSWorkspace.shared.open(f) } catch { alert("Couldn’t create the calendar file.") }
            return
        }
        let panel = NSSavePanel(); panel.nameFieldStringValue = safe
        panel.beginSheetModal(for: window) { r in if r == .OK, let u = panel.url { try? text.write(to: u, atomically: true, encoding: .utf8) } }
    }
}

setvbuf(stdout, nil, _IOLBF, 0)   // line-buffered, so test output survives the process being stopped
let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
