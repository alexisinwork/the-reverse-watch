import { describe, expect, it } from "vitest";

import {
  asHttps,
  imageSize,
  namesAnotherVariant,
  NOT_A_PRODUCT_PHOTO,
  pagePrice,
  photoAddresses,
  photoSourceKind,
  productPhotoShape,
} from "./photo-rules";

describe("photoSourceKind", () => {
  it("prefers the maker, accepts shops and grey-market dealers", () => {
    expect(
      photoSourceKind("https://www.longines.com/p/watch-x", "Longines"),
    ).toBe("maker");
    expect(photoSourceKind("https://www.mayors.com/p/1", "Breitling")).toBe(
      "shop",
    );
    expect(
      photoSourceKind("https://www.1stdibs.com/jewelry/x", "Cartier"),
    ).toBe("grey");
    expect(
      photoSourceKind("https://www.chrono24.com/omega/x.htm", "Omega"),
    ).toBe("grey");
  });

  it("takes no photo from magazines, social sites or plain http", () => {
    expect(
      photoSourceKind("https://www.hodinkee.com/articles/x", "Omega"),
    ).toBeNull();
    expect(
      photoSourceKind("https://www.instagram.com/p/x", "Omega"),
    ).toBeNull();
    expect(photoSourceKind("http://shop.example/x", "Omega")).toBeNull();
  });
});

describe("namesAnotherVariant", () => {
  it("flags a sibling reference in an address", () => {
    // Breitling's page and photo of U17395211A1U1 for U17395211A1P1.
    expect(
      namesAnotherVariant(
        "https://www-breitling.eu.saleor.cloud/media/thumbnails/products/u17395211a1u1-soldier_1024.png",
        "U17395211A1P1",
      ),
    ).toBe(true);
    expect(
      namesAnotherVariant(
        "https://www.bremont.com/products/model-247-ti-gmt-bracelet",
        "247-TI-GMT-BK",
      ),
    ).toBe(true);
  });

  it("accepts the reference itself, in any spelling, and addresses without one", () => {
    expect(
      namesAnotherVariant(
        "https://api.ecom.longines.com/media/w/a/watch-collection-hydroconquest-l3-781-4-05-6-17733c-hero.png",
        "L3.781.4.05.6",
      ),
    ).toBe(false);
    expect(
      namesAnotherVariant(
        "https://shop.example/media/17531849_1.jpg",
        "U17395211A1P1",
      ),
    ).toBe(false);
  });
});

describe("photo filters", () => {
  it("refuses logos, share cards and drawings", () => {
    for (const path of [
      "/og-image.svg",
      "/static/logo.png",
      "/img/og_default.jpg",
      "/x/banner-1.jpg",
    ])
      expect(NOT_A_PRODUCT_PHOTO.test(path)).toBe(true);
    expect(
      NOT_A_PRODUCT_PHOTO.test("/productimage/17531849/17531849_1.jpg"),
    ).toBe(false);
  });

  it("refuses wide banners and tiny pictures, keeps product shapes", () => {
    expect(productPhotoShape({ width: 1920, height: 1080 })).toBe(false);
    expect(productPhotoShape({ width: 1200, height: 630 })).toBe(false);
    expect(productPhotoShape({ width: 120, height: 120 })).toBe(false);
    expect(productPhotoShape({ width: 265, height: 265 })).toBe(true);
    expect(productPhotoShape({ width: 650, height: 800 })).toBe(true);
    expect(productPhotoShape(null)).toBe(true);
  });

  it("asks for https", () => {
    expect(asHttps("http://dreamspakistan.com/cdn/shop/files/64969.png")).toBe(
      "https://dreamspakistan.com/cdn/shop/files/64969.png",
    );
  });
});

describe("imageSize", () => {
  it("reads PNG, GIF, JPEG and WebP headers", () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47]);
    new DataView(png.buffer).setUint32(16, 1920);
    new DataView(png.buffer).setUint32(20, 1080);
    expect(imageSize(png)).toEqual({ width: 1920, height: 1080 });

    const gif = new Uint8Array(10);
    gif.set([0x47, 0x49, 0x46]);
    new DataView(gif.buffer).setUint16(6, 300, true);
    new DataView(gif.buffer).setUint16(8, 200, true);
    expect(imageSize(gif)).toEqual({ width: 300, height: 200 });

    // SOI, an APP0 segment of 16 bytes, then SOF0 with height 800, width 650.
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      ...new Array(14).fill(0),
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x03,
      0x20,
      0x02,
      0x8a,
      0x03,
      0,
      0,
      0,
      0,
      0,
      0,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 650, height: 800 });

    const webp = new Uint8Array(30);
    webp.set([...Buffer.from("RIFF"), 0, 0, 0, 0, ...Buffer.from("WEBPVP8X")]);
    webp.set([0xff, 0x01, 0x00, 0x7f, 0x02, 0x00], 24); // 512 × 640
    expect(imageSize(webp)).toEqual({ width: 512, height: 640 });

    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });
});

describe("photoAddresses", () => {
  it("prefers the page's own product photo, then og:image, then a picture naming the reference", () => {
    const html = `
      <meta property="og:image" content="/share.jpg">
      <script type="application/ld+json">{"@type":"Product","name":"Pilot T149.459.21.051.00","image":["https://cdn.example/a.jpg"],"offers":{"price":"2100","priceCurrency":"USD"}}</script>
      <img src="/media/T149-459-21-051-00_front.jpg" alt="">`;
    const { addresses, product } = photoAddresses(
      html,
      "https://maker.example/p/1",
      "T149.459.21.051.00",
    );
    expect(addresses).toEqual([
      "https://cdn.example/a.jpg",
      "https://maker.example/share.jpg",
      "https://maker.example/media/T149-459-21-051-00_front.jpg",
    ]);
    expect(pagePrice(html, product)).toEqual({ amount: 2100, currency: "USD" });
  });

  it("takes from a page about several products only the one naming the reference", () => {
    const html = `<script type="application/ld+json">[
      {"@type":"Product","name":"Other 1234","image":"https://cdn.example/other.jpg"},
      {"@type":"Product","name":"Wanted 5678","image":"https://cdn.example/wanted.jpg"}]</script>`;
    expect(
      photoAddresses(html, "https://shop.example/", "5678").addresses,
    ).toEqual(["https://cdn.example/wanted.jpg"]);
  });
});
