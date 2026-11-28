// My Bible: the book Library (Ben's iCloud Drive "Authors" folder: EPUB, PDF, and Kindle MOBI/AZW3).
// bible://app/lib/index.json   every book, from file and folder names only (instant; nothing is downloaded)
// bible://app/lib/file/<id>     the book's bytes for the reader (EPUB or PDF). Reading an iCloud file that isn't on
//                               this Mac downloads it first. Folders named *.epub are zipped on the fly; MOBI/AZW3
//                               are converted to EPUB once with calibre's ebook-convert and cached.
// bible://app/lib/cover/<id>    a cover picture from Quick Look, cached in ~/Library/Caches/My Bible/covers.
// The books never leave this Mac through the app: they are not in the bundle, the git repo or the phone site.

import Foundation
import QuickLookThumbnailing
import AppKit

final class BookLibrary {
    static let shared = BookLibrary()
    struct Book { let id: String; let url: URL; let title: String; let author: String; let kind: String; let size: Int; let added: Double; let local: Bool }

    private let fm = FileManager.default
    private(set) var books: [String: Book] = [:]
    private lazy var caches = fm.urls(for: .cachesDirectory, in: .userDomainMask)[0].appendingPathComponent("My Bible")
    let work = DispatchQueue(label: "library", attributes: .concurrent)

    var folder: URL {
        if let p = UserDefaults.standard.string(forKey: "libraryFolder") { return URL(fileURLWithPath: p) }
        return URL(fileURLWithPath: NSHomeDirectory()).appendingPathComponent("Library/Mobile Documents/com~apple~CloudDocs/Authors")
    }
    func setFolder(_ u: URL) { UserDefaults.standard.set(u.path, forKey: "libraryFolder") }

    // MARK: index
    static let kinds = ["epub": "epub", "pdf": "pdf", "mobi": "mobi", "azw3": "mobi", "azw": "mobi"]
    /// One walk at a time (the background refresh and a book lookup can both ask).
    private let idxQ = DispatchQueue(label: "library-index")
    func indexJSON() -> Data { idxQ.sync { buildIndex() } }
    private func buildIndex() -> Data {
        let root = folder
        guard fm.fileExists(atPath: root.path) else { return Data(#"{"books":[],"missing":true}"#.utf8) }
        var found: [String: Book] = [:]
        let keys: [URLResourceKey] = [.isDirectoryKey, .fileSizeKey, .creationDateKey, .ubiquitousItemDownloadingStatusKey]
        guard let e = fm.enumerator(at: root, includingPropertiesForKeys: keys, options: [.skipsHiddenFiles]) else { return Data(#"{"books":[]}"#.utf8) }
        for case let u as URL in e {
            let ext = u.pathExtension.lowercased()
            guard let kind = Self.kinds[ext] else { continue }
            let v = try? u.resourceValues(forKeys: Set(keys))
            let isDir = v?.isDirectory ?? false
            if isDir { e.skipDescendants(); if ext != "epub" { continue } }
            let rel = u.path.replacingOccurrences(of: root.path + "/", with: "")
            let parts = rel.split(separator: "/").map(String.init)
            let author = parts.count > 1 ? parts[0].trimmingCharacters(in: .whitespaces) : ""
            let status = v?.ubiquitousItemDownloadingStatus
            let local = isDir || status == nil || status == .current || status == .downloaded
            let b = Book(id: EpubLibrary.fnv(u.path), url: u, title: Self.title(u.deletingPathExtension().lastPathComponent, author),
                         author: author, kind: isDir ? "epubdir" : kind, size: v?.fileSize ?? 0,
                         added: v?.creationDate?.timeIntervalSince1970 ?? 0, local: local)
            found[b.id] = b
        }
        books = found
        // the same title as EPUB and MOBI: keep the EPUB (Kindle files are only listed when there's no EPUB)
        var best: [String: Book] = [:]
        for b in found.values {
            let k = Self.norm(b.title) + "|" + Self.norm(b.author) + "|" + (b.kind == "pdf" ? "pdf" : "book")
            if let o = best[k] {
                let rank = { (x: Book) -> Int in x.kind == "epub" ? 0 : x.kind == "epubdir" ? 1 : 2 }
                if rank(b) < rank(o) { best[k] = b }
            } else { best[k] = b }
        }
        // Kindle file names were cut at 40 characters by calibre ("You Matter to God: Discovering Your True"):
        // drop a Kindle book when an EPUB by the same author starts with its (cut) title
        let epubTitles = Dictionary(grouping: best.values.filter { $0.kind != "mobi" && $0.kind != "pdf" }, by: { Self.norm($0.author) }).mapValues { $0.map { Self.norm($0.title) } }
        for (k, b) in best where b.kind == "mobi" {
            let t = Self.norm(b.title)
            if t.count >= 12, (epubTitles[Self.norm(b.author)] ?? []).contains(where: { $0.hasPrefix(t) }) { best[k] = nil }
        }
        let list = best.values.sorted { $0.author == $1.author ? $0.title < $1.title : $0.author < $1.author }.map {
            ["id": $0.id, "t": $0.title, "a": $0.author, "k": $0.kind, "s": $0.size, "d": Int($0.added), "l": $0.local] as [String: Any]
        }
        let out = (try? JSONSerialization.data(withJSONObject: ["books": list, "folder": root.path])) ?? Data(#"{"books":[]}"#.utf8)
        try? fm.createDirectory(at: caches, withIntermediateDirectories: true)
        try? out.write(to: caches.appendingPathComponent("library-index.json"))
        return out
    }
    /// The list from last time straight away (walking 3,000 iCloud files takes a few seconds), refreshed in the background.
    func quickIndexJSON() -> Data {
        let saved = caches.appendingPathComponent("library-index.json")
        if UserDefaults.standard.string(forKey: "libraryIndexFolder") == folder.path, let d = try? Data(contentsOf: saved) {
            if idxQ.sync(execute: { books.isEmpty }) { work.async { _ = self.indexJSON() } }
            return d
        }
        let d = indexJSON(); UserDefaults.standard.set(folder.path, forKey: "libraryIndexFolder"); return d
    }
    /// "Born After Midnight", "The Holy Spirit - Emmanuel Nterful" → "The Holy Spirit", "Prayer_ A Guide" → "Prayer: A Guide"
    static func title(_ name: String, _ author: String) -> String {
        var t = name
        if !author.isEmpty, t.lowercased().hasSuffix(" - " + author.lowercased()) { t = String(t.dropLast(author.count + 3)) }
        t = t.replacingOccurrences(of: "_ ", with: ": ").replacingOccurrences(of: "_", with: " ")
        if t.hasSuffix(", The") { t = "The " + t.dropLast(5) }
        return t.trimmingCharacters(in: .whitespaces)
    }
    static func norm(_ s: String) -> String { s.lowercased().filter { $0.isLetter || $0.isNumber } }

    // MARK: files
    func book(_ id: String) -> Book? {
        idxQ.sync { if books[id] == nil { _ = buildIndex() }; return books[id] }
    }
    /// The bytes the reader opens, and their type ("epub" or "pdf").
    func file(_ id: String) -> (Data, String)? {
        guard let b = book(id) else { return nil }
        switch b.kind {
        case "pdf": return (try? Data(contentsOf: b.url)).map { ($0, "pdf") }
        case "epub": return (try? Data(contentsOf: b.url)).map { ($0, "epub") }
        case "epubdir":
            let out = caches.appendingPathComponent("lib/\(id).epub")
            if !fm.fileExists(atPath: out.path) {
                try? fm.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
                run("/usr/bin/zip", ["-q", "-X", "-r", out.path, "."], cwd: b.url)
            }
            return (try? Data(contentsOf: out)).map { ($0, "epub") }
        default:   // mobi / azw3 → epub with calibre
            let out = caches.appendingPathComponent("lib/\(id).epub")
            if !fm.fileExists(atPath: out.path) {
                let conv = "/Applications/calibre.app/Contents/MacOS/ebook-convert"
                guard fm.fileExists(atPath: conv) else { return nil }
                try? fm.createDirectory(at: out.deletingLastPathComponent(), withIntermediateDirectories: true)
                _ = try? Data(contentsOf: b.url)   // make sure iCloud has downloaded it
                run(conv, [b.url.path, out.path], cwd: nil)
            }
            return (try? Data(contentsOf: out)).map { ($0, "epub") }
        }
    }
    @discardableResult func run(_ exe: String, _ args: [String], cwd: URL?) -> Int32 {
        let p = Process(); p.executableURL = URL(fileURLWithPath: exe); p.arguments = args
        if let cwd { p.currentDirectoryURL = cwd }
        p.standardOutput = FileHandle.nullDevice; p.standardError = FileHandle.nullDevice
        do { try p.run() } catch { return -1 }
        p.waitUntilExit(); return p.terminationStatus
    }

    // MARK: covers (Quick Look makes them for EPUB and PDF; it downloads the book from iCloud if needed)
    func cover(_ id: String, done: @escaping (Data?) -> Void) {
        let file = caches.appendingPathComponent("covers2/\(id).jpg")   // covers2: retry books the old finder missed
        if let d = try? Data(contentsOf: file) { return done(d.isEmpty ? nil : d) }
        guard let b = book(id) else { return done(nil) }
        try? fm.createDirectory(at: file.deletingLastPathComponent(), withIntermediateDirectories: true)
        let keep = { (d: Data?) in try? (d ?? Data()).write(to: file); done(d) }   // an empty file = no cover; don't try again
        // the book has to be on this Mac first (it's a few hundred KB for most EPUBs); if it was only in iCloud,
        // it goes back to iCloud-only once the cover is read, so browsing covers doesn't fill the disk
        let wasLocal = b.local
        if b.kind != "epubdir", (try? Data(contentsOf: b.url, options: .alwaysMapped)) == nil { return done(nil) }
        let evict = { if !wasLocal && b.kind != "epubdir" { try? self.fm.evictUbiquitousItem(at: b.url) } }
        let save = { (d: Data?) in keep(d); evict() }
        // EPUB: the cover picture named in the book itself (fast, and what the publisher chose)
        if b.kind == "epub", let d = Self.epubCover(b.url).flatMap({ Self.small($0) }) { return save(d) }
        if b.kind == "mobi" {
            let meta = "/Applications/calibre.app/Contents/MacOS/ebook-meta", tmp = caches.appendingPathComponent("covers2/\(id).tmp.jpg")
            guard fm.fileExists(atPath: meta) else { return save(nil) }
            run(meta, [b.url.path, "--get-cover=" + tmp.path], cwd: nil)
            let d = try? Data(contentsOf: tmp); try? fm.removeItem(at: tmp)
            return save(d.flatMap { Self.small($0) })
        }
        if b.kind == "epubdir" {
            let imgs = (fm.enumerator(at: b.url, includingPropertiesForKeys: nil)?.allObjects as? [URL] ?? []).filter { ["jpg", "jpeg", "png"].contains($0.pathExtension.lowercased()) }
            let pick = imgs.first { $0.lastPathComponent.lowercased().contains("cover") } ?? imgs.first
            return save(pick.flatMap { try? Data(contentsOf: $0) }.flatMap { Self.small($0) })
        }
        let req = QLThumbnailGenerator.Request(fileAt: b.url, size: CGSize(width: 240, height: 360), scale: 2, representationTypes: .thumbnail)
        QLThumbnailGenerator.shared.generateBestRepresentation(for: req) { rep, _ in
            guard let cg = rep?.cgImage else { return save(nil) }
            save(NSBitmapImageRep(cgImage: cg).representation(using: .jpeg, properties: [.compressionFactor: 0.8]))
        }
    }
    /// The cover image an EPUB names in its package file (EPUB 3 cover-image, EPUB 2 <meta name="cover">, or an image called cover).
    static func epubCover(_ u: URL) -> Data? {
        guard let c = EpubLibrary.member(u, "META-INF/container.xml"),
              let opfPath = EpubLibrary.first(#"full-path="([^"]+)""#, EpubLibrary.text(c)),
              let od = EpubLibrary.member(u, opfPath) else { return nil }
        let opf = EpubLibrary.text(od), base = (opfPath as NSString).deletingLastPathComponent
        var items: [[String: String]] = []
        for tag in EpubLibrary.all(#"<item\b[^>]*>"#, opf) {
            var a: [String: String] = [:]
            for kv in EpubLibrary.groups(#"([\w:.-]+)\s*=\s*"([^"]*)""#, tag) where kv.count == 2 { a[kv[0]] = kv[1] }
            items.append(a)
        }
        let isImg = { (a: [String: String]) in (a["media-type"] ?? "").hasPrefix("image/") }
        var href: String? = items.first(where: { ($0["properties"] ?? "").contains("cover-image") })?["href"]
        if href == nil, let id = EpubLibrary.first(#"<meta[^>]*name="cover"[^>]*content="([^"]+)""#, opf) ?? EpubLibrary.first(#"<meta[^>]*content="([^"]+)"[^>]*name="cover""#, opf) {
            href = items.first(where: { $0["id"] == id && isImg($0) })?["href"]
        }
        // <meta name="cover"> often names the file ("FORGIVENESS.jpg") instead of a manifest id
        if href == nil, let c = EpubLibrary.first(#"<meta[^>]*name="cover"[^>]*content="([^"]+)""#, opf) ?? EpubLibrary.first(#"<meta[^>]*content="([^"]+)"[^>]*name="cover""#, opf) {
            href = items.first(where: { isImg($0) && (($0["href"] ?? "") == c || ($0["href"] ?? "").hasSuffix("/" + c)) })?["href"]
            if href == nil, c.range(of: #"\.(jpe?g|png|gif|webp)$"#, options: [.regularExpression, .caseInsensitive]) != nil,
               EpubLibrary.member(u, EpubLibrary.join(base, c)) != nil { href = c }
        }
        // the picture on the cover page: the <guide> cover reference, a page called cover, else the book's first page
        func pageImage(_ page: String) -> Data? {
            guard let pd = EpubLibrary.member(u, page) else { return nil }
            let t = EpubLibrary.text(pd)
            guard let src = EpubLibrary.first(#"<img[^>]+src\s*=\s*["']([^"']+)["']"#, t) ?? EpubLibrary.first(#"<image[^>]+href\s*=\s*["']([^"']+)["']"#, t) else { return nil }
            let dir = (page as NSString).deletingLastPathComponent
            return EpubLibrary.member(u, EpubLibrary.join(dir, src.removingPercentEncoding ?? src))
        }
        if href == nil, let g = EpubLibrary.first(##"<reference[^>]*type="cover"[^>]*href="([^"#]+)"##, opf) ?? EpubLibrary.first(##"<reference[^>]*href="([^"#]+)[^"]*"[^>]*type="cover""##, opf),
           let d = pageImage(EpubLibrary.join(base, g)) { return d }
        if href == nil { href = items.first(where: { isImg($0) && (($0["id"] ?? "") + ($0["href"] ?? "")).lowercased().contains("cover") })?["href"] }
        if href == nil {
            if let cp = items.first(where: { ($0["media-type"] ?? "").contains("html") && ($0["href"] ?? "").lowercased().contains("cover") })?["href"],
               let d = pageImage(EpubLibrary.join(base, cp)) { return d }
            if let first = EpubLibrary.first(#"<itemref[^>]*idref="([^"]+)""#, opf), let fh = items.first(where: { $0["id"] == first })?["href"],
               let d = pageImage(EpubLibrary.join(base, fh)) { return d }
        }
        guard let h = href else { return nil }
        return EpubLibrary.member(u, EpubLibrary.join(base, h))
    }
    /// A cover picture shrunk to 480 px tall, as JPEG.
    static func small(_ d: Data) -> Data? {
        guard let img = NSImage(data: d), let cg = img.cgImage(forProposedRect: nil, context: nil, hints: nil) else { return nil }
        let h = min(480, cg.height), w = max(1, cg.width * h / max(1, cg.height))
        guard let ctx = CGContext(data: nil, width: w, height: h, bitsPerComponent: 8, bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else { return nil }
        ctx.interpolationQuality = .high; ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))
        guard let out = ctx.makeImage() else { return nil }
        return NSBitmapImageRep(cgImage: out).representation(using: .jpeg, properties: [.compressionFactor: 0.82])
    }
}
