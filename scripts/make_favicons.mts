/**
 * Favicons from design/prototype.html's mark (green rounded square, white
 * Groundwork mark): public/favicon.svg, favicon-32.png, apple-touch-icon.png
 * (180px, full-bleed: iOS rounds the corners itself) and favicon.ico (the
 * 32px PNG in an ICO container, for browsers that ask for /favicon.ico).
 *
 *   npx tsx scripts/make_favicons.mts
 */
import { writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const BRAND = '#1E6B52'
const MARK = 'M7 24h18M11 18.5h10M14 13h4M16 6v7'
const svg = (rx: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="${rx}" fill="${BRAND}"/>` +
  `<path d="${MARK}" stroke="white" stroke-width="3" stroke-linecap="round"/></svg>\n`

writeFileSync('public/favicon.svg', svg(8))

const browser = await chromium.launch()
const page = await browser.newPage()
async function png(size: number, rx: number): Promise<Buffer> {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img style="display:block;width:${size}px;height:${size}px" src="data:image/svg+xml;base64,${Buffer.from(svg(rx)).toString('base64')}"></body></html>`,
  )
  return page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } })
}
const p32 = await png(32, 8)
writeFileSync('public/favicon-32.png', p32)
writeFileSync('public/apple-touch-icon.png', await png(180, 0))
await browser.close()

// ICO with one embedded PNG image (supported by every current browser).
const header = Buffer.alloc(6)
header.writeUInt16LE(0, 0)
header.writeUInt16LE(1, 2)
header.writeUInt16LE(1, 4)
const entry = Buffer.alloc(16)
entry.writeUInt8(32, 0)
entry.writeUInt8(32, 1)
entry.writeUInt8(0, 2)
entry.writeUInt8(0, 3)
entry.writeUInt16LE(1, 4)
entry.writeUInt16LE(32, 6)
entry.writeUInt32LE(p32.length, 8)
entry.writeUInt32LE(6 + 16, 12)
writeFileSync('public/favicon.ico', Buffer.concat([header, entry, p32]))
console.log('wrote public/favicon.svg, favicon-32.png, apple-touch-icon.png, favicon.ico')
