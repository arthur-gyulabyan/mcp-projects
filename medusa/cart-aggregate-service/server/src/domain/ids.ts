import { customAlphabet } from "nanoid";

const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const generate = customAlphabet(alphabet, 22);

export const newId = (prefix: string): string => `${prefix}_${generate()}`;

export const cartId = () => newId("cart");
export const lineItemId = () => newId("cali");
export const shippingMethodId = () => newId("casm");
export const creditLineId = () => newId("cacl");
export const lineItemAdjustmentId = () => newId("caliadj");
export const lineItemTaxLineId = () => newId("calitxl");
export const shippingMethodAdjustmentId = () => newId("casmadj");
export const shippingMethodTaxLineId = () => newId("casmtxl");
