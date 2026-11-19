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
        let base = Bundle.main.resourceURL!.appendingPathComponent("web")
        let file = base.appendingPathComponent(String(path.dropFirst())).standardizedFileURL
        guard file.path.hasPrefix(base.path), let data = try? Data(contentsOf: file) else {
            task.didFailWithError(NSError(domain: NSURLErrorDomain, code: NSURLErrorFileDoesNotExist))
            return
        }
        let type = ["html": "text/html; charset=utf-8", "js": "text/javascript", "css": "text/css", "png": "image/png"][file.pathExtension] ?? "application/octet-stream"
        let response = HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Type": type, "Content-Length": String(data.count)])!
        task.didReceive(response)
        task.didReceive(data)
        task.didFinish()
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
        file.addItem(item("Import a Bible (XML)…", #selector(importBible), "o"))
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
        go.addItem(item("Highlights and Notes", #selector(highlights), "b", [.command, .shift]))
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
    @objc func highlights() { js("closeSheets(); showMarks('all')") }
    @objc func settings() { js("document.getElementById('gear').click()") }
    @objc func showAbout() { js("closeSheets(); document.getElementById('modal').classList.add('open')") }
    @objc func zoomIn() { web.pageZoom = min(web.pageZoom + 0.1, 2.5) }
    @objc func zoomOut() { web.pageZoom = max(web.pageZoom - 0.1, 0.6) }
    @objc func zoomReset() { web.pageZoom = 1 }

    /// File → Import: read the XML natively and hand the text to the page's importer.
    @objc func importBible() {
        let panel = NSOpenPanel()
        panel.allowedContentTypes = [.xml, .data]
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
                    return 'after reload: localStorage=' + ls + ' indexedDB=' + (m ? m.name : 'missing') + ' | ' + document.title + ' | versions=' + Object.keys(VN).length + ' | fonts=' + (window.MAC_FONTS||[]).length + ' e.g. ' + (window.MAC_FONTS||[]).slice(0,4).join(', ');
                    """, arguments: [:], in: nil, in: .page) { r in
                    print("SELFTEST", r)
                    NSApp.terminate(nil)
                }
            }
        }
    }
    func userContentController(_ c: WKUserContentController, didReceive message: WKScriptMessage) {
        print("page:", message.body)
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.activate(ignoringOtherApps: true)
app.run()
