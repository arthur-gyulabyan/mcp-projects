import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { captureEvent, makeRepo } from "./helpers.js";
import { createCart } from "../src/application/commands/create-cart.js";
import { updateCart } from "../src/application/commands/update-cart.js";
import {
  deleteCart,
  restoreCart,
} from "../src/application/commands/delete-restore-cart.js";
import {
  setBillingAddress,
  setShippingAddress,
} from "../src/application/commands/addresses.js";
import {
  addLineItem,
  removeLineItem,
  updateLineItem,
} from "../src/application/commands/line-items.js";
import {
  addShippingMethod,
  removeShippingMethod,
} from "../src/application/commands/shipping-methods.js";
import {
  setLineItemAdjustments,
  setLineItemTaxLines,
  setShippingMethodAdjustments,
  setShippingMethodTaxLines,
} from "../src/application/commands/adjustments.js";
import {
  addCreditLine,
  removeCreditLine,
} from "../src/application/commands/credit-lines.js";
import { getCart } from "../src/application/queries/get-cart.js";
import { listCarts } from "../src/application/queries/list-carts.js";
import type { CartRepository } from "../src/infrastructure/cart-repository.js";

let repo: CartRepository;
let close: () => void;

beforeEach(() => {
  const r = makeRepo();
  repo = r.repo;
  close = r.close;
});

afterEach(() => close());

describe("CreateCart", () => {
  it("returns a cart with an assigned id and currency code EUR", () => {
    const cap = captureEvent("CartCreated");
    const cart = createCart(repo, { currencyCode: "EUR" });
    expect(cart.id).toMatch(/^cart_/);
    expect(cart.currencyCode).toBe("eur");
    expect(cap.events).toHaveLength(1);
    cap.unsubscribe();
  });

  it("rejects creation when currencyCode is missing with a required-field error", () => {
    expect(() => createCart(repo, {})).toThrowError(/currencyCode/);
  });

  it("attaches inline billing and shipping addresses", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      billingAddress: { firstName: "Alice", lastName: "A", city: "Berlin" },
      shippingAddress: { firstName: "Alice", lastName: "A", city: "Berlin" },
    });
    expect(cart.billingAddress?.firstName).toBe("Alice");
    expect(cart.shippingAddress?.city).toBe("Berlin");
  });

  it("attaches an inline line item (title, quantity, unitPrice)", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "Sweater", quantity: 1, unitPrice: "100" }],
    });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.title).toBe("Sweater");
    expect(cart.items[0]!.quantity).toBe(1);
    expect(cart.items[0]!.unitPrice).toBe("100");
  });
});

describe("UpdateCart", () => {
  it("updates the cart's email", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = updateCart(repo, { id: cart.id, email: "alice@example.com" });
    expect(updated.email).toBe("alice@example.com");
  });

  it("rejects update for non-existent id with NOT_FOUND", () => {
    expect(() => updateCart(repo, { id: "cart_does_not_exist", email: "x" })).toThrowError(
      /not found/i,
    );
  });
});

describe("DeleteCart", () => {
  it("is no longer listed under its id", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    deleteCart(repo, cart.id);
    expect(() => getCart(repo, cart.id)).toThrowError(/not found/i);
    const list = listCarts(repo);
    expect(list.find((c) => c.id === cart.id)).toBeUndefined();
  });
});

describe("RestoreCart", () => {
  it("restores a soft-deleted cart", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    deleteCart(repo, cart.id);
    restoreCart(repo, cart.id);
    const restored = getCart(repo, cart.id);
    expect(restored.id).toBe(cart.id);
    expect(restored.deletedAt).toBeNull();
  });
});

describe("SetShippingAddress / SetBillingAddress", () => {
  it("reflects the shipping address that was set", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = setShippingAddress(repo, cart.id, {
      firstName: "Bob",
      city: "Stockholm",
    });
    expect(updated.shippingAddress?.firstName).toBe("Bob");
  });

  it("updates first name on existing shipping address", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      shippingAddress: { firstName: "Old", city: "Berlin" },
    });
    const updated = setShippingAddress(repo, cart.id, {
      firstName: "New",
      city: "Berlin",
    });
    expect(updated.shippingAddress?.firstName).toBe("New");
  });

  it("sets a billing address", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = setBillingAddress(repo, cart.id, { firstName: "Carol" });
    expect(updated.billingAddress?.firstName).toBe("Carol");
  });
});

describe("AddLineItem", () => {
  it("adds a line item with title, quantity 1, unitPrice 100", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = addLineItem(repo, cart.id, [
      { title: "Belt", quantity: 1, unitPrice: "100" },
    ]);
    expect(updated.items).toHaveLength(1);
    expect(updated.items[0]!.title).toBe("Belt");
    expect(updated.items[0]!.unitPrice).toBe("100");
  });

  it("rejects add when cart id does not exist (NOT_FOUND)", () => {
    expect(() =>
      addLineItem(repo, "cart_missing", [
        { title: "Belt", quantity: 1, unitPrice: "100" },
      ]),
    ).toThrowError(/not found/i);
  });

  it("rejects add when quantity is missing with required-field error", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    expect(() =>
      addLineItem(repo, cart.id, [
        { title: "Belt", unitPrice: "100" },
      ]),
    ).toThrowError(/quantity/);
  });
});

describe("UpdateLineItem", () => {
  it("updates a line item title", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "Old", quantity: 1, unitPrice: "100" }],
    });
    const lineItemId = cart.items[0]!.id;
    const updated = updateLineItem(repo, cart.id, [
      { id: lineItemId, title: "New" },
    ]);
    expect(updated.items[0]!.title).toBe("New");
  });

  it("updates multiple line items in one call", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [
        { title: "A", quantity: 1, unitPrice: "10" },
        { title: "B", quantity: 1, unitPrice: "20" },
      ],
    });
    const [a, b] = cart.items;
    const updated = updateLineItem(repo, cart.id, [
      { id: a!.id, title: "A2" },
      { id: b!.id, title: "B2" },
    ]);
    const titles = updated.items.map((i) => i.title).sort();
    expect(titles).toEqual(["A2", "B2"]);
  });
});

describe("RemoveLineItem", () => {
  it("removes the only line item leaving an empty collection", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "X", quantity: 1, unitPrice: "10" }],
    });
    const updated = removeLineItem(repo, cart.id, [
      { id: cart.items[0]!.id },
    ]);
    expect(updated.items).toHaveLength(0);
  });

  it("removes multiple items leaving the collection empty", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [
        { title: "A", quantity: 1, unitPrice: "10" },
        { title: "B", quantity: 1, unitPrice: "20" },
      ],
    });
    const updated = removeLineItem(
      repo,
      cart.id,
      cart.items.map((i) => ({ id: i.id })),
    );
    expect(updated.items).toHaveLength(0);
  });
});

describe("AddShippingMethod", () => {
  it("adds a shipping method (name, amount=100)", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = addShippingMethod(repo, cart.id, [
      { name: "Standard", amount: "100" },
    ]);
    expect(updated.shippingMethods).toHaveLength(1);
    expect(updated.shippingMethods[0]!.amount).toBe("100");
  });

  it("rejects a shipping method with a negative amount", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    expect(() =>
      addShippingMethod(repo, cart.id, [{ name: "Bad", amount: "-1" }]),
    ).toThrowError(/greater than or equal to 0/);
  });
});

describe("RemoveShippingMethod", () => {
  it("removes the shipping method", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Standard", amount: "100" },
    ]);
    const after = removeShippingMethod(repo, cart.id, [
      { id: withMethod.shippingMethods[0]!.id },
    ]);
    expect(after.shippingMethods).toHaveLength(0);
  });
});

describe("SetLineItemAdjustments", () => {
  it("sets adjustments for each line item", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [
        { title: "A", quantity: 1, unitPrice: "100" },
        { title: "B", quantity: 1, unitPrice: "200" },
      ],
    });
    const updated = setLineItemAdjustments(repo, cart.id, [
      {
        id: cart.items[0]!.id,
        adjustments: [{ amount: "10", code: "X10" }],
      },
      {
        id: cart.items[1]!.id,
        adjustments: [{ amount: "20", code: "X20" }],
      },
    ]);
    const adjs = updated.items.flatMap((i) => i.adjustments ?? []);
    expect(adjs).toHaveLength(2);
    expect(adjs.map((a) => a.amount).sort()).toEqual(["10", "20"]);
  });

  it("replaces existing adjustment when a different one is set for the same line item", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    const id = cart.items[0]!.id;
    setLineItemAdjustments(repo, cart.id, [
      { id, adjustments: [{ amount: "10", code: "OLD" }] },
    ]);
    const after = setLineItemAdjustments(repo, cart.id, [
      { id, adjustments: [{ amount: "20", code: "NEW" }] },
    ]);
    expect(after.items[0]!.adjustments).toHaveLength(1);
    expect(after.items[0]!.adjustments![0]!.code).toBe("NEW");
  });

  it("removes all adjustments when set to an empty list", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    const id = cart.items[0]!.id;
    setLineItemAdjustments(repo, cart.id, [
      { id, adjustments: [{ amount: "10" }] },
    ]);
    const after = setLineItemAdjustments(repo, cart.id, [
      { id, adjustments: [] },
    ]);
    expect(after.items[0]!.adjustments).toHaveLength(0);
  });

  it("updates an existing adjustment by id in place", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    const id = cart.items[0]!.id;
    const seeded = setLineItemAdjustments(repo, cart.id, [
      { id, adjustments: [{ amount: "10", code: "OLD" }] },
    ]);
    const existingAdjId = seeded.items[0]!.adjustments![0]!.id!;
    const after = setLineItemAdjustments(repo, cart.id, [
      {
        id,
        adjustments: [{ id: existingAdjId, amount: "30", code: "NEW" }],
      },
    ]);
    expect(after.items[0]!.adjustments).toHaveLength(1);
    expect(after.items[0]!.adjustments![0]!.id).toBe(existingAdjId);
    expect(after.items[0]!.adjustments![0]!.amount).toBe("30");
    expect(after.items[0]!.adjustments![0]!.code).toBe("NEW");
  });
});

describe("SetShippingMethodAdjustments", () => {
  it("sets adjustments for shipping methods", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Standard", amount: "100" },
    ]);
    const updated = setShippingMethodAdjustments(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        adjustments: [{ amount: "10", code: "FREESHIP" }],
      },
    ]);
    expect(updated.shippingMethods[0]!.adjustments).toHaveLength(1);
  });

  it("removes all shipping-method adjustments when set to empty", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Standard", amount: "100" },
    ]);
    setShippingMethodAdjustments(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        adjustments: [{ amount: "10" }],
      },
    ]);
    const after = setShippingMethodAdjustments(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        adjustments: [],
      },
    ]);
    expect(after.shippingMethods[0]!.adjustments).toHaveLength(0);
  });

  it("rejects an adjustment for a shipping method that belongs to another cart", () => {
    const cartA = createCart(repo, { currencyCode: "EUR" });
    const cartAWithMethod = addShippingMethod(repo, cartA.id, [
      { name: "Standard", amount: "100" },
    ]);
    const cartB = createCart(repo, { currencyCode: "EUR" });
    expect(() =>
      setShippingMethodAdjustments(repo, cartB.id, [
        {
          id: cartAWithMethod.shippingMethods[0]!.id,
          adjustments: [{ amount: "10" }],
        },
      ]),
    ).toThrowError(/does not belong to cart/);
  });
});

describe("SetLineItemTaxLines", () => {
  it("sets tax lines for each line item", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    const updated = setLineItemTaxLines(repo, cart.id, [
      {
        id: cart.items[0]!.id,
        taxLines: [{ code: "VAT", rate: "25" }],
      },
    ]);
    expect(updated.items[0]!.taxLines).toHaveLength(1);
    expect(updated.items[0]!.taxLines![0]!.code).toBe("VAT");
  });

  it("removes all line-item tax lines when set to empty", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    setLineItemTaxLines(repo, cart.id, [
      { id: cart.items[0]!.id, taxLines: [{ code: "VAT", rate: "25" }] },
    ]);
    const after = setLineItemTaxLines(repo, cart.id, [
      { id: cart.items[0]!.id, taxLines: [] },
    ]);
    expect(after.items[0]!.taxLines).toHaveLength(0);
  });

  it("upserts: one existing id updated, one new created, omitted removed", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [{ title: "A", quantity: 1, unitPrice: "100" }],
    });
    const liId = cart.items[0]!.id;
    const seeded = setLineItemTaxLines(repo, cart.id, [
      {
        id: liId,
        taxLines: [
          { code: "VAT", rate: "25" },
          { code: "OLD", rate: "5" },
        ],
      },
    ]);
    const keepId = seeded.items[0]!.taxLines!.find((t) => t.code === "VAT")!.id!;
    const after = setLineItemTaxLines(repo, cart.id, [
      {
        id: liId,
        taxLines: [
          { id: keepId, code: "VAT", rate: "20" },
          { code: "NEW", rate: "10" },
        ],
      },
    ]);
    const codes = after.items[0]!.taxLines!.map((t) => t.code).sort();
    expect(codes).toEqual(["NEW", "VAT"]);
    const vat = after.items[0]!.taxLines!.find((t) => t.code === "VAT")!;
    expect(vat.id).toBe(keepId);
    expect(vat.rate).toBe("20");
  });
});

describe("SetShippingMethodTaxLines", () => {
  it("sets tax lines on shipping methods", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Std", amount: "10" },
    ]);
    const updated = setShippingMethodTaxLines(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        taxLines: [{ code: "VAT", rate: "25" }],
      },
    ]);
    expect(updated.shippingMethods[0]!.taxLines).toHaveLength(1);
  });

  it("removes all shipping-method tax lines when set to empty", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Std", amount: "10" },
    ]);
    setShippingMethodTaxLines(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        taxLines: [{ code: "VAT", rate: "25" }],
      },
    ]);
    const after = setShippingMethodTaxLines(repo, cart.id, [
      {
        id: withMethod.shippingMethods[0]!.id,
        taxLines: [],
      },
    ]);
    expect(after.shippingMethods[0]!.taxLines).toHaveLength(0);
  });
});

describe("AddCreditLine / RemoveCreditLine", () => {
  it("adds a credit line referencing a refund or gift card", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const updated = addCreditLine(repo, cart.id, [
      { amount: "50", reference: "refund", referenceId: "refund_01" },
    ]);
    expect(updated.creditLines).toHaveLength(1);
    expect(updated.creditLines[0]!.reference).toBe("refund");
  });

  it("removes a credit line", () => {
    const cart = createCart(repo, { currencyCode: "EUR" });
    const withCl = addCreditLine(repo, cart.id, [{ amount: "50" }]);
    const after = removeCreditLine(repo, cart.id, [
      { id: withCl.creditLines[0]!.id },
    ]);
    expect(after.creditLines).toHaveLength(0);
  });
});

describe("GetCart (totals projection)", () => {
  it("projects the documented totals example", () => {
    const cart = createCart(repo, {
      currencyCode: "EUR",
      items: [
        { title: "A", quantity: 1, unitPrice: "100" },
        { title: "B", quantity: 2, unitPrice: "200" },
      ],
    });
    const withMethod = addShippingMethod(repo, cart.id, [
      { name: "Standard", amount: "10" },
    ]);
    setLineItemAdjustments(repo, cart.id, [
      { id: withMethod.items[0]!.id, adjustments: [{ amount: "100" }] },
      { id: withMethod.items[1]!.id, adjustments: [{ amount: "200" }] },
    ]);
    const view = getCart(repo, cart.id);
    expect(view.totals.itemTotal).toBe("200");
    expect(view.totals.originalItemTotal).toBe("500");
    expect(view.totals.shippingTotal).toBe("10");
    expect(view.totals.discountTotal).toBe("300");
    expect(view.totals.total).toBe("210");
    expect(view.totals.subtotal).toBe("510");
    expect(view.totals.taxTotal).toBe("0");
  });
});
