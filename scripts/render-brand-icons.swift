import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

// Deterministic packaging of the cleaned artwork, with no external imaging dependencies.
let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2], isDirectory: true)
guard let source = CGImageSourceCreateWithURL(input as CFURL, nil),
      let original = CGImageSourceCreateImageAtIndex(source, 0, nil) else { fatalError("Cannot decode brand master") }
let colorSpace = CGColorSpace(name: CGColorSpace.sRGB)!
let sizes = [16,20,24,29,32,40,48,58,60,64,72,76,80,87,96,120,128,144,152,167,180,192,256,384,512,1024]
let probe = CGContext(data: nil, width: original.width, height: original.height, bitsPerComponent: 8, bytesPerRow: original.width * 4, space: colorSpace, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
probe.draw(original, in: CGRect(x: 0, y: 0, width: original.width, height: original.height))
let pixels = probe.data!.assumingMemoryBound(to: UInt8.self)
// Trim only external transparent padding; retain the rounded tile and its artwork.
var minX = original.width, minY = original.height, maxX = 0, maxY = 0
for y in 0..<original.height { for x in 0..<original.width {
    if pixels[(y * original.width + x) * 4 + 3] > 127 {
        minX = min(minX,x); minY = min(minY,y); maxX = max(maxX,x); maxY = max(maxY,y)
    }
}}
let image = original.cropping(to: CGRect(x:minX,y:minY,width:maxX-minX+1,height:maxY-minY+1))!
// The tile's own navy supplies opaque platform corners, avoiding an invented border.
let sample = ((minY + max(2,image.height / 30)) * original.width + (minX+maxX) / 2) * 4
let navy = CGColor(colorSpace: colorSpace, components: [CGFloat(pixels[sample])/255, CGFloat(pixels[sample+1])/255, CGFloat(pixels[sample+2])/255, 1])!
var markRadius: Double = 0
for y in minY...maxY { for x in minX...maxX {
    let offset=(y * original.width + x)*4
    let r=pixels[offset],g=pixels[offset+1],b=pixels[offset+2]
    if pixels[offset+3] > 200 && r > 160 && ((g < 180 && b < 130) || (g > 155 && b > 135)) {
        markRadius=max(markRadius,hypot((Double(x-minX)+0.5)/Double(image.width)-0.5,(Double(y-minY)+0.5)/Double(image.height)-0.5))
    }
}}
let maskScale = CGFloat(min(0.85,0.39 / markRadius))
func render(_ size: Int, _ name: String, opaque: Bool = false, scale: CGFloat = 1) {
    let context = CGContext(data: nil, width: size, height: size, bitsPerComponent: 8, bytesPerRow: size * 4, space: colorSpace, bitmapInfo: opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue)!
    if opaque { context.setFillColor(navy); context.fill(CGRect(x: 0,y: 0,width: size,height: size)) }
    context.interpolationQuality = .high
    let extent = CGFloat(size) * scale, inset = (CGFloat(size) - extent) / 2
    context.draw(image, in: CGRect(x: inset, y: inset, width: extent, height: extent))
    // Suppress subvisible resampling residue in the transparent outer corners.
    if !opaque, let data = context.data?.assumingMemoryBound(to: UInt8.self) {
        for offset in stride(from: 0, to: size * size * 4, by: 4) where data[offset+3] < 3 {
            data[offset] = 0; data[offset+1] = 0; data[offset+2] = 0; data[offset+3] = 0
        }
    }
    let result = context.makeImage()!
    let destination = CGImageDestinationCreateWithURL(output.appendingPathComponent(name) as CFURL, UTType.png.identifier as CFString, 1, nil)!
    CGImageDestinationAddImage(destination, result, nil)
    precondition(CGImageDestinationFinalize(destination), "PNG encoding failed")
}
try FileManager.default.createDirectory(at: output, withIntermediateDirectories: true)
for size in sizes { render(size, "scribe-\(size).png") }
for size in [120,152,167,180] { render(size, "scribe-apple-touch-\(size).png", opaque: true) }
render(1024, "scribe-store-1024.png", opaque: true)
// Keep the full mark inside the standardized central safe circle for adaptive OS masks.
for size in [192,512,1024] { render(size, "scribe-maskable-\(size).png", opaque: true, scale: maskScale) }
print("Rendered \(sizes.count + 8) brand PNG variants from the cleaned master.")

print("Maskable artwork scale: \(maskScale); critical mark stays within radius 39%. Artwork colors are unchanged.")
