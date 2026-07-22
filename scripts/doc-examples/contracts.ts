export interface CheckoutProps {
  readonly cartId: string;
}

export interface ShopContracts {
  readonly checkout: CheckoutProps;
}
