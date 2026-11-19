// Draws the app icon (a book with a ribbon) at 1024 px.
// Usage: swift mac/make_icon.swift out.png [full]
//   full = square, edge-to-edge background for phone home screens (iOS/Android round the corners themselves)
import Cocoa
let full = CommandLine.arguments.count > 2 && CommandLine.arguments[2] == "full"
let size: CGFloat = 1024
let img = NSImage(size: NSSize(width: size, height: size))
img.lockFocus()
let ctx = NSGraphicsContext.current!.cgContext
// rounded-square background, deep blue gradient
let bg = full ? NSBezierPath(rect: NSRect(x: 0, y: 0, width: 1024, height: 1024)) : NSBezierPath(roundedRect: NSRect(x: 100, y: 100, width: 824, height: 824), xRadius: 185, yRadius: 185)
NSGradient(starting: NSColor(calibratedRed: 0.13, green: 0.20, blue: 0.38, alpha: 1),
           ending: NSColor(calibratedRed: 0.05, green: 0.08, blue: 0.18, alpha: 1))!.draw(in: bg, angle: -90)
ctx.setShadow(offset: CGSize(width: 0, height: -14), blur: 30, color: NSColor.black.withAlphaComponent(0.35).cgColor)
// open book: two pages
let cream = NSColor(calibratedRed: 0.98, green: 0.96, blue: 0.91, alpha: 1)
for left in [true, false] {
    let p = NSBezierPath()
    let x0: CGFloat = 512, dir: CGFloat = left ? -1 : 1
    p.move(to: NSPoint(x: x0, y: 300))
    p.curve(to: NSPoint(x: x0 + dir * 300, y: 330), controlPoint1: NSPoint(x: x0 + dir * 90, y: 270), controlPoint2: NSPoint(x: x0 + dir * 210, y: 290))
    p.line(to: NSPoint(x: x0 + dir * 300, y: 720))
    p.curve(to: NSPoint(x: x0, y: 700), controlPoint1: NSPoint(x: x0 + dir * 210, y: 690), controlPoint2: NSPoint(x: x0 + dir * 90, y: 670))
    p.close()
    cream.setFill(); p.fill()
}
ctx.setShadow(offset: .zero, blur: 0, color: nil)
// text lines
NSColor(calibratedRed: 0.55, green: 0.52, blue: 0.47, alpha: 0.55).setFill()
for i in 0..<5 {
    let y = CGFloat(620 - i * 55)
    NSBezierPath(roundedRect: NSRect(x: 265, y: y, width: 190, height: 14), xRadius: 7, yRadius: 7).fill()
    NSBezierPath(roundedRect: NSRect(x: 569, y: y, width: 190, height: 14), xRadius: 7, yRadius: 7).fill()
}
// red ribbon
NSColor(calibratedRed: 0.78, green: 0.16, blue: 0.18, alpha: 1).setFill()
let r = NSBezierPath()
r.move(to: NSPoint(x: 492, y: 700)); r.line(to: NSPoint(x: 532, y: 700)); r.line(to: NSPoint(x: 532, y: 210))
r.line(to: NSPoint(x: 512, y: 235)); r.line(to: NSPoint(x: 492, y: 210)); r.close(); r.fill()
img.unlockFocus()
let rep = NSBitmapImageRep(data: img.tiffRepresentation!)!
try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: CommandLine.arguments[1]))
