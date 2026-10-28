import { describe, expect, it } from "vitest";
import { referencedProductImage } from "./referenced-product-image.server";

const page = (data: unknown) =>
  `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
describe("exact-reference product image", () => {
  it("extracts a product image for the exact reference", () => {
    expect(
      referencedProductImage(
        page({
          "@type": "Product",
          brand: "Seiko",
          sku: "SPB143",
          image: "/watch.jpg",
        }),
        "SPB143",
        "Seiko",
        "https://maker.example/model",
      ),
    ).toBe("https://maker.example/watch.jpg");
  });
  it("rejects article thumbnails, other variants and ambiguous products", () => {
    for (const data of [
      {
        "@type": "Article",
        brand: "Seiko",
        sku: "SPB143",
        image: "/article.jpg",
      },
      {
        "@type": "Product",
        brand: "Seiko",
        sku: "SPB143J1",
        image: "/other.jpg",
      },
      {
        "@type": "Product",
        brand: "Other",
        sku: "SPB143",
        image: "/other.jpg",
      },
      [
        {
          "@type": "Product",
          brand: "Seiko",
          sku: "SPB143",
          image: "/one.jpg",
        },
        {
          "@type": "Product",
          brand: "Seiko",
          sku: "SPB143",
          image: "/two.jpg",
        },
      ],
      {
        "@type": "Product",
        brand: "Seiko",
        sku: "SPB143",
        image: "http://127.0.0.1/private",
      },
    ])
      expect(
        referencedProductImage(
          page(data),
          "SPB143",
          "Seiko",
          "https://maker.example/model",
        ),
      ).toBeNull();
  });
});
