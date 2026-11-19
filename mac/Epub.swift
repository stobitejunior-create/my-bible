// My Bible: Ben's Dag Heward-Mills EPUB folder, for reading the chapter the random picker lands on.
// The page asks for bible://app/epub-index.json (each book's title and table of contents) and loads chapters from
// bible://app/epub/<id>/<path inside the EPUB>. Books are unzipped on first open into ~/Library/Caches/My Bible/epub.
// The books never leave this Mac: they are not in the app bundle, the git repo or the phone site.

import Foundation

final class EpubLibrary {
    static let shared = EpubLibrary()
    struct Book: Codable { let id: String; let file: String; let title: String; let toc: [[String]]; let mtime: Double }

    private(set) var books: [Book] = []
    private(set) var building = false
    private let queue = DispatchQueue(label: "epub-index")
    private let fm = FileManager.default
    private lazy var support = fm.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0].appendingPathComponent("My Bible")
    private lazy var caches = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("My Bible/epub")

    /// The folder chosen in File → Choose Book Folder, or the project's ePUB folder if it exists.
    var folder: URL? {
        if let p = UserDefaults.standard.string(forKey: "epubFolder") { return URL(fileURLWithPath: p) }
        let d = URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Developer/My Bible/bible-app/ePUB")
        return fm.fileExists(atPath: d.path) ? d : nil
    }
    func setFolder(_ url: URL, done: @escaping () -> Void) { UserDefaults.standard.set(url.path, forKey: "epubFolder"); rebuild(done: done) }

    /// Reads every .epub in the folder (in parallel; unchanged files come from the saved index).
    func rebuild(done: (() -> Void)? = nil) {
        guard let folder else { books = []; done?(); return }
        building = true
        queue.async { [self] in
            let saved = support.appendingPathComponent("epub-index.json")
            var old: [String: Book] = [:]
            if let d = try? Data(contentsOf: saved), let list = try? JSONDecoder().decode([Book].self, from: d) { for b in list { old[b.file] = b } }
            var files: [URL] = []
            if let e = fm.enumerator(at: folder, includingPropertiesForKeys: [.contentModificationDateKey], options: [.skipsHiddenFiles]) {
                for case let u as URL in e where u.pathExtension.lowercased() == "epub" { files.append(u) }
            }
            var out = [Book?](repeating: nil, count: files.count)
            let lock = NSLock()
            DispatchQueue.concurrentPerform(iterations: files.count) { i in
                let u = files[i]
                let mt = (try? u.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate?.timeIntervalSince1970 ?? 0
                let b = (old[u.path].flatMap { $0.mtime == mt ? $0 : nil }) ?? Self.read(u, mtime: mt)
                lock.lock(); out[i] = b; lock.unlock()
            }
            let list = out.compactMap { $0 }
            try? fm.createDirectory(at: support, withIntermediateDirectories: true)
            if let d = try? JSONEncoder().encode(list) { try? d.write(to: saved) }
            DispatchQueue.main.async { self.books = list; self.building = false; done?() }
        }
    }

    func indexJSON() -> Data {
        if building && books.isEmpty { return Data(#"{"building":true}"#.utf8) }
        let list = books.map { ["id": $0.id, "title": $0.title, "toc": $0.toc] as [String: Any] }
        return (try? JSONSerialization.data(withJSONObject: ["books": list])) ?? Data(#"{"books":[]}"#.utf8)
    }

    /// A file from inside a book, unzipping the book the first time.
    func file(_ id: String, _ inner: String) -> Data? {
        guard let b = books.first(where: { $0.id == id }) else { return nil }
        let dir = caches.appendingPathComponent(id), mark = dir.appendingPathComponent(".unzipped")
        if !fm.fileExists(atPath: mark.path) {
            try? fm.createDirectory(at: dir, withIntermediateDirectories: true)
            _ = Self.unzip(["-qq", "-o", b.file, "-d", dir.path])
            fm.createFile(atPath: mark.path, contents: nil)
        }
        let f = dir.appendingPathComponent(inner).standardizedFileURL
        guard f.path.hasPrefix(dir.standardizedFileURL.path) else { return nil }
        return try? Data(contentsOf: f)
    }

    // MARK: reading one EPUB
    static func unzip(_ args: [String]) -> Data? {
        let p = Process(); p.executableURL = URL(fileURLWithPath: "/usr/bin/unzip"); p.arguments = args
        let out = Pipe(); p.standardOutput = out; p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return nil }
        let d = out.fileHandleForReading.readDataToEndOfFile(); p.waitUntilExit()
        return p.terminationStatus == 0 || !d.isEmpty ? d : nil
    }
    static func member(_ file: URL, _ path: String) -> Data? { unzip(["-p", file.path, path]) }
    static func text(_ d: Data) -> String { String(data: d, encoding: .utf8) ?? String(decoding: d, as: UTF8.self) }

    static func read(_ u: URL, mtime: Double) -> Book? {
        guard let c = member(u, "META-INF/container.xml"),
              let opfPath = first(#"full-path="([^"]+)""#, text(c)),
              let od = member(u, opfPath) else { return nil }
        let opf = text(od), base = (opfPath as NSString).deletingLastPathComponent
        let title = clean(first(#"<dc:title[^>]*>([\s\S]*?)</dc:title>"#, opf) ?? u.deletingPathExtension().lastPathComponent)
        var items: [[String: String]] = []
        for tag in all(#"<item\b[^>]*>"#, opf) {
            var a: [String: String] = [:]
            for kv in groups(#"([\w:.-]+)\s*=\s*"([^"]*)""#, tag) where kv.count == 2 { a[kv[0]] = kv[1] }
            items.append(a)
        }
        var toc: [[String]] = []
        if let nav = items.first(where: { ($0["properties"] ?? "").split(separator: " ").contains("nav") }), let h = nav["href"] {
            toc = navTOC(u, join(base, h))
        }
        if toc.isEmpty, let ncx = items.first(where: { $0["media-type"] == "application/x-dtbncx+xml" || ($0["href"] ?? "").hasSuffix(".ncx") }), let h = ncx["href"] {
            toc = ncxTOC(u, join(base, h))
        }
        return Book(id: fnv(u.path), file: u.path, title: title, toc: toc, mtime: mtime)
    }

    /// Top-level entries of an EPUB 3 nav document, as [label, path from the EPUB root].
    static func navTOC(_ u: URL, _ path: String) -> [[String]] {
        guard let d = member(u, path), let doc = xml(d) else { return [] }
        let dir = (path as NSString).deletingLastPathComponent
        let navs = (try? doc.nodes(forXPath: "//*[local-name()='nav']")) as? [XMLElement] ?? []
        guard let nav = navs.first(where: { ($0.attributes ?? []).contains { ($0.localName == "type") && ($0.stringValue ?? "").contains("toc") } }) ?? navs.first,
              let ol = ((try? nav.nodes(forXPath: ".//*[local-name()='ol']")) as? [XMLElement])?.first else { return [] }
        var out: [[String]] = []
        for li in (ol.children ?? []).compactMap({ $0 as? XMLElement }) where li.localName == "li" {
            guard let a = ((try? li.nodes(forXPath: "./*[local-name()='a' or local-name()='span']")) as? [XMLElement])?.first else { continue }
            let label = clean(a.stringValue ?? "")
            let href = a.attribute(forName: "href")?.stringValue ?? ""
            if !label.isEmpty, !href.isEmpty { out.append([label, join(dir, href)]) }
        }
        return out
    }
    /// Top-level navPoints of an EPUB 2 NCX file.
    static func ncxTOC(_ u: URL, _ path: String) -> [[String]] {
        guard let d = member(u, path), let doc = xml(d) else { return [] }
        let dir = (path as NSString).deletingLastPathComponent
        let maps = (try? doc.nodes(forXPath: "//*[local-name()='navMap']")) as? [XMLElement] ?? []
        guard let map = maps.first else { return [] }
        var out: [[String]] = []
        for np in (map.children ?? []).compactMap({ $0 as? XMLElement }) where np.localName == "navPoint" {
            let label = ((try? np.nodes(forXPath: "./*[local-name()='navLabel']/*[local-name()='text']")) as? [XMLNode])?.first?.stringValue ?? ""
            let src = ((try? np.nodes(forXPath: "./*[local-name()='content']/@src")) as? [XMLNode])?.first?.stringValue ?? ""
            if !src.isEmpty { out.append([clean(label), join(dir, src)]) }
        }
        return out
    }

    // MARK: helpers
    static func xml(_ d: Data) -> XMLDocument? { (try? XMLDocument(data: d, options: [])) ?? (try? XMLDocument(data: d, options: [.documentTidyHTML])) }
    static func join(_ dir: String, _ rel: String) -> String {
        let parts = rel.split(separator: "#", maxSplits: 1).map(String.init)
        let raw = (parts.first ?? "").removingPercentEncoding ?? (parts.first ?? "")
        let joined = dir.isEmpty ? raw : (dir as NSString).appendingPathComponent(raw)
        var stack: [Substring] = []
        for p in joined.split(separator: "/") { if p == ".." { _ = stack.popLast() } else if p != "." { stack.append(p) } }
        return stack.joined(separator: "/") + (parts.count > 1 ? "#" + parts[1] : "")
    }
    static func clean(_ s: String) -> String {
        let decoded = s.replacingOccurrences(of: "&amp;", with: "&").replacingOccurrences(of: "&#39;", with: "'").replacingOccurrences(of: "&quot;", with: "\"").replacingOccurrences(of: "&lt;", with: "<").replacingOccurrences(of: "&gt;", with: ">")
        let noTags = decoded.replacingOccurrences(of: "<[^>]+>", with: "", options: .regularExpression)
        return noTags.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespaces)
    }
    static func fnv(_ s: String) -> String {
        var h: UInt64 = 0xcbf29ce484222325
        for b in s.utf8 { h ^= UInt64(b); h = h &* 0x100000001b3 }
        return String(h, radix: 16)
    }
    static func first(_ pattern: String, _ s: String) -> String? { groups(pattern, s).first?.first }
    static func all(_ pattern: String, _ s: String) -> [String] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).compactMap { Range($0.range, in: s).map { String(s[$0]) } }
    }
    static func groups(_ pattern: String, _ s: String) -> [[String]] {
        guard let re = try? NSRegularExpression(pattern: pattern) else { return [] }
        return re.matches(in: s, range: NSRange(s.startIndex..., in: s)).map { m in
            (1..<m.numberOfRanges).compactMap { Range(m.range(at: $0), in: s).map { String(s[$0]) } }
        }
    }
}
